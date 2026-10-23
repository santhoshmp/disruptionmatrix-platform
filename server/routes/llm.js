// llm.js — API routes for LLM provider settings
// Supports three purposes: 'prediction' (event scoring), 'conversation' (chat), 'profiling' (threat profiling)
// Each purpose has its own enabled flag, active provider, and provider configs.

import { Router } from 'express';
import llmService from '../engine/llm-service.js';

const router = Router();

// ── Get LLM status + all provider configs (all purposes) ──────────
router.get('/', async (_req, res) => {
  try {
    const [
      predictionEnabled,
      conversationEnabled,
      profilingEnabled,
      predictionProvider,
      conversationProvider,
      profilingProvider,
      predictionConfigs,
      conversationConfigs,
      profilingConfigs,
    ] = await Promise.all([
      llmService.isLLMEnabled(),
      llmService.isConversationLLMEnabled(),
      llmService.isProfilingLLMEnabled(),
      llmService.getActiveProvider(),
      llmService.getConversationActiveProvider(),
      llmService.getProfilingActiveProvider(),
      llmService.getProviderConfigs('prediction'),
      llmService.getProviderConfigs('conversation'),
      llmService.getProviderConfigs('profiling'),
    ]);
    res.json({
      prediction: {
        enabled: predictionEnabled,
        activeProvider: predictionProvider,
        providers: predictionConfigs,
      },
      conversation: {
        enabled: conversationEnabled,
        activeProvider: conversationProvider,
        providers: conversationConfigs,
      },
      profiling: {
        enabled: profilingEnabled,
        activeProvider: profilingProvider,
        providers: profilingConfigs,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Toggle prediction LLM on/off ────────────────────────────────────
router.put('/prediction/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    await llmService.setLLMEnabled(!!enabled);
    res.json({ enabled: !!enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Toggle conversation LLM on/off ──────────────────────────────────
router.put('/conversation/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    await llmService.setConversationLLMEnabled(!!enabled);
    res.json({ enabled: !!enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Toggle profiling LLM on/off ──────────────────────────────────────
router.put('/profiling/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    await llmService.setProfilingLLMEnabled(!!enabled);
    res.json({ enabled: !!enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Set active provider for prediction ─────────────────────────────
router.put('/prediction/active-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });
    await llmService.setActiveProvider(provider);
    res.json({ activeProvider: provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Set active provider for conversation ───────────────────────────
router.put('/conversation/active-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });
    await llmService.setConversationActiveProvider(provider);
    res.json({ activeProvider: provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Set active provider for profiling ──────────────────────────────
router.put('/profiling/active-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });
    await llmService.setProfilingActiveProvider(provider);
    res.json({ activeProvider: provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Save provider config (for a specific purpose) ───────────────────
// URL: /api/llm/providers/:provider?purpose=prediction|conversation
router.put('/providers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, apiBase, model, enabled } = req.body;
    const purpose = req.query.purpose || 'prediction';
    if (!['prediction', 'conversation', 'profiling'].includes(purpose)) {
      return res.status(400).json({ error: 'purpose must be prediction, conversation, or profiling' });
    }
    await llmService.saveProviderConfig(provider, { apiKey, apiBase, model, enabled, purpose });
    res.json({ provider, purpose, saved: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test LLM connection (for a specific purpose) ────────────────────
// URL: /api/llm/test?purpose=prediction|conversation|profiling
router.post('/test', async (req, res) => {
  try {
    const purpose = req.query.purpose || 'prediction';
    const result = await llmService.chatCompletion(
      [{ role: 'user', content: 'Say "LLM connection successful" in exactly 4 words.' }],
      { maxTokens: 20, temperature: 0, purpose }
    );
    if (!result) {
      return res.json({
        success: false,
        message: `${purpose} LLM is disabled or not configured`,
        purpose,
      });
    }
    res.json({
      success: true,
      purpose,
      provider: result.provider,
      model: result.model,
      response: result.content,
    });
  } catch (e) {
    res.json({ success: false, message: e.message, purpose: req.query.purpose || 'prediction' });
  }
});

export default router;
