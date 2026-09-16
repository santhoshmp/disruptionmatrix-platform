// chat.js — API routes for the RAG-powered conversation agent
// POST /api/chat          — send a question, get an answer with context
// GET  /api/chat/suggest   — get suggested questions based on current data
// POST /api/chat/index     — rebuild the RAG index (admin)
// GET  /api/chat/stats     — RAG index statistics

import { Router } from 'express';
import conversationAgent from '../engine/conversation-agent.js';
import ragIndexer from '../engine/rag-indexer.js';
import ragRetriever from '../engine/rag-retriever.js';
import llmService from '../engine/llm-service.js';

const router = Router();

// ── Chat: send a question ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { question, history, docTypes, topK } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const result = await conversationAgent.chat(question, {
      conversationHistory: history || [],
      docTypes: docTypes || null,
      topK: topK || 8,
    });

    // Include conversation LLM status in the response
    const convEnabled = await llmService.isConversationLLMEnabled();
    const convProvider = await llmService.getConversationActiveProvider();

    res.json({
      ...result,
      conversationLLM: {
        enabled: convEnabled,
        provider: convProvider,
      },
    });
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get suggested questions ──────────────────────────────────────
router.get('/suggest', async (req, res) => {
  try {
    const suggestions = await conversationAgent.getSuggestedQuestions();
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rebuild RAG index (admin action) ────────────────────────────
router.post('/index', async (req, res) => {
  try {
    console.log('[chat] Rebuilding RAG index...');
    const results = await ragIndexer.indexAll();
    const stats = await ragRetriever.getStats();
    res.json({ success: true, indexed: results, stats });
  } catch (err) {
    console.error('[chat] index rebuild failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get RAG index statistics ─────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await ragRetriever.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test retrieval (debug) ──────────────────────────────────────
router.post('/retrieve', async (req, res) => {
  const { query, docTypes, topK } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const documents = await ragRetriever.retrieve(query, {
      docTypes: docTypes || null,
      topK: topK || 10,
    });
    res.json({
      query,
      documents: documents.map((d) => ({
        type: d.docType,
        sourceId: d.sourceId,
        score: d.score,
        preview: d.content.slice(0, 200),
        sources: d.sources,
      })),
      count: documents.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
