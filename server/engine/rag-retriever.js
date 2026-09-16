// rag-retriever.js — Hybrid retrieval for RAG
// Combines:
//   1. Full-text search (PostgreSQL tsvector + ts_rank) — always available
//   2. Trigram similarity (pg_trgm) — always available, fuzzy keyword matching
//   3. Vector similarity (embedding cosine) — when LLM is enabled
// Uses Reciprocal Rank Fusion (RRF) to merge results from all methods.

import ragRepo from '../db/repositories/rag.js';
import llmService from './llm-service.js';

const RRF_K = 60; // RRF constant (standard value)

// ── Main retrieval function ───────────────────────────────────────
export async function retrieve(query, options = {}) {
  const { topK = 8, docTypes = null, useVector = true } = options;

  // Run all retrieval methods in parallel
  const [ftsResults, trigramResults, vectorResults] = await Promise.all([
    ragRepo.searchFullText(query, { limit: topK * 2, docTypes }).catch(() => []),
    ragRepo.searchTrigram(query, { limit: topK * 2, docTypes }).catch(() => []),
    useVector ? vectorSearch(query, { limit: topK * 2, docTypes }).catch(() => []) : [],
  ]);

  // Apply Reciprocal Rank Fusion
  const fused = reciprocalRankFusion([
    { results: ftsResults, weight: 1.0 },
    { results: trigramResults, weight: 0.7 },
    { results: vectorResults, weight: 1.2 }, // vector search gets higher weight when available
  ]);

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
      const rrfScore = weight * (1 / (RRF_K + i + 1));
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
