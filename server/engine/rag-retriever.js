// rag-retriever.js — Hybrid retrieval for RAG
// Combines:
//   1. Full-text search (PostgreSQL tsvector + ts_rank) — always available
//   2. Trigram similarity (pg_trgm) — always available, fuzzy keyword matching
//   3. Vector similarity (embedding cosine) — when LLM is enabled
//   4. Structured query intent — detects "critical threats", "top events", etc.
// Uses Reciprocal Rank Fusion (RRF) to merge results from all methods.

import ragRepo from '../db/repositories/rag.js';
import llmService from './llm-service.js';
import pool from '../db/pool.js';
import * as refLoader from '../data/reference-loader.js';

// Phase 7: read from DB-backed ref_connectors via loader
const _rrfK = () => refLoader.getConnectorConfig('rag', 'rrf_k', 60);
const _vectorThreshold = () => refLoader.getConnectorConfig('rag', 'vector_threshold', 0.5);

// ── Query intent detection ─────────────────────────────────────────
// Detects when the user is asking for "top/critical/severe threats"
// and fetches high-EDPS events directly instead of relying on keyword search.
const INTENT_PATTERNS = [
  { pattern: /critical (threat|event|disruption)/i, minScore: 70, intent: 'critical' },
  { pattern: /most (critical|severe|serious|important|urgent)/i, minScore: 70, intent: 'critical' },
  { pattern: /(top|highest|biggest|worst|major) (threat|event|disruption)/i, minScore: 70, intent: 'top' },
  { pattern: /(what.*threat|current threat|active threat|live threat|ongoing)/i, minScore: 50, intent: 'active' },
  { pattern: /(severe|high impact|high priority)/i, minScore: 65, intent: 'severe' },
  { pattern: /(what.*happening|what.*going on|current|right now|status)/i, minScore: 50, intent: 'active' },
];

function detectQueryIntent(query) {
  for (const { pattern, minScore, intent } of INTENT_PATTERNS) {
    if (pattern.test(query)) return { minScore, intent };
  }
  return null;
}

// Fetch top events by EDPS score directly from the RAG index
async function fetchTopEvents(minScore, limit = 8) {
  try {
    const res = await pool.query(`
      SELECT id, doc_type, source_id, content, metadata
      FROM rag_documents
      WHERE doc_type = 'event'
        AND (metadata->>'score')::int >= $1
      ORDER BY (metadata->>'score')::int DESC
      LIMIT $2
    `, [minScore, limit]);

    return res.rows.map(r => ({
      id: r.id,
      docType: r.doc_type,
      sourceId: r.source_id,
      content: r.content,
      metadata: r.metadata,
      score: 1.0, // high base score so RRF ranks these well
    }));
  } catch (e) {
    console.error('[rag-retriever] fetchTopEvents error:', e.message);
    return [];
  }
}

// ── Main retrieval function ───────────────────────────────────────
export async function retrieve(query, options = {}) {
  const { topK = 8, docTypes = null, useVector = true } = options;

  // Detect query intent — if asking for "critical threats", fetch top events directly
  const intent = detectQueryIntent(query);
  const intentResults = intent ? await fetchTopEvents(intent.minScore, topK * 2) : [];

  // Run all retrieval methods in parallel
  const [ftsResults, trigramResults, vectorResults] = await Promise.all([
    ragRepo.searchFullText(query, { limit: topK * 2, docTypes }).catch(() => []),
    ragRepo.searchTrigram(query, { limit: topK * 2, docTypes }).catch(() => []),
    useVector ? vectorSearch(query, { limit: topK * 2, docTypes }).catch(() => []) : [],
  ]);

  // Build ranked lists for RRF
  const rankedLists = [
    { results: ftsResults, weight: 1.0 },
    { results: trigramResults, weight: 0.7 },
    { results: vectorResults, weight: 1.2 }, // vector search gets higher weight when available
  ];

  // If intent detected, add structured results with high weight
  if (intentResults.length > 0) {
    rankedLists.push({ results: intentResults, weight: 1.5 });
  }

  // Apply Reciprocal Rank Fusion
  const fused = reciprocalRankFusion(rankedLists);

  // If we have intent results but RRF didn't surface enough events, boost them
  if (intent && fused.filter(d => d.docType === 'event').length < 3 && intentResults.length > 0) {
    // Prepend intent results that aren't already in the fused list
    const existing = new Set(fused.map(d => `${d.docType}:${d.sourceId}`));
    for (const doc of intentResults) {
      const key = `${doc.docType}:${doc.sourceId}`;
      if (!existing.has(key)) {
        fused.push(doc);
        existing.add(key);
      }
    }
    fused.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  return fused.slice(0, topK);
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────
// Combines ranked lists from multiple retrieval methods.
// RRF(d) = Σ (1 / (k + rank_i(d)))  for each ranked list i
function reciprocalRankFusion(rankedLists) {
  const scores = new Map();

  for (const { results, weight } of rankedLists) {
    for (let i = 0; i < results.length; i++) {
      const doc = results[i];
      const key = `${doc.docType}:${doc.sourceId}`;
      const rrfScore = weight * (1 / (_rrfK() + i + 1));
      scores.set(key, {
        docType: doc.docType,
        sourceId: doc.sourceId,
        content: doc.content,
        metadata: doc.metadata,
        score: (scores.get(key)?.score || 0) + rrfScore,
        sources: [...(scores.get(key)?.sources || []), { method: doc.docType, rank: i + 1, rawScore: doc.score }],
      });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}

// ── Vector search (embedding-based) ──────────────────────────────
// When LLM is enabled, compute query embedding and compare with stored embeddings.
// Falls back to JS-side cosine similarity if pgvector is not available.
async function vectorSearch(query, options = {}) {
  const { limit = 20, docTypes = null } = options;

  // Get query embedding from LLM provider
  const queryEmbedding = await getQueryEmbedding(query);
  if (!queryEmbedding) return [];

  // Get all documents with embeddings
  const docs = await ragRepo.getDocumentsWithEmbeddings(docTypes);
  if (docs.length === 0) return [];

  // Compute cosine similarity in JS (since pgvector may not be available locally)
  const scored = docs.map((doc) => {
    const sim = cosineSimilarity(queryEmbedding, doc.embedding);
    return {
      id: doc.id,
      docType: doc.docType,
      sourceId: doc.sourceId,
      content: doc.content,
      metadata: doc.metadata,
      score: sim,
    };
  });

  return scored
    .filter((d) => d.score > 0.5) // threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── Get query embedding from LLM provider ────────────────────────
// Uses the conversation-purpose config (since RAG is for the chat agent)
async function getQueryEmbedding(text) {
  try {
    const config = await llmService.getConfigForPurpose('conversation');
    if (!config) return null;

    const { provider, apiKey, apiBase, model } = config;

    switch (provider) {
      case 'openai':
      case 'azure':
        return await getOpenAIEmbedding(apiKey, apiBase, text, provider);
      case 'custom':
        // Custom/private cloud endpoints may support OpenAI-compatible embeddings
        return await getOpenAIEmbedding(apiKey, apiBase, text, 'openai');
      default:
        // Other providers (anthropic, google, mistral) may not have embedding APIs
        return null;
    }
  } catch (e) {
    console.error('[rag-retriever] embedding error:', e.message);
    return null;
  }
}

async function getOpenAIEmbedding(apiKey, apiBase, text, provider) {
  const base = apiBase || 'https://api.openai.com/v1';
  const url = provider === 'azure'
    ? `${base}/embeddings?api-version=2024-02-15-preview`
    : `${base}/embeddings`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [provider === 'azure' ? 'api-key' : 'Authorization']: provider === 'azure' ? apiKey : `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.embedding || null;
}

// ── Cosine similarity ────────────────────────────────────────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Build context for the LLM ────────────────────────────────────
// Takes retrieved documents and formats them into a context string
export function buildContext(documents, maxChars = 8000) {
  const parts = [];
  let totalChars = 0;

  for (const doc of documents) {
    const header = `[${doc.docType.toUpperCase()}] ${doc.sourceId}`;
    const section = `${header}\n${doc.content}\n`;
    if (totalChars + section.length > maxChars) break;
    parts.push(section);
    totalChars += section.length;
  }

  return parts.join('\n---\n\n');
}

// ── Get index stats ──────────────────────────────────────────────
export async function getStats() {
  const counts = await ragRepo.getCounts();
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  return { total, byType: counts };
}

export default { retrieve, buildContext, getStats };
