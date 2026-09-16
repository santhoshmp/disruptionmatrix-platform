// conversation-agent.js — RAG-powered conversation agent
// Takes a user question, retrieves relevant context from the RAG index,
// and calls the LLM with a system prompt + context + question.
// Returns the answer with source citations.

import ragRetriever from './rag-retriever.js';
import llmService from './llm-service.js';
import store from '../store/event-store.js';

const SYSTEM_PROMPT = `You are DisruptionMatrix AI, an aviation disruption intelligence assistant.
You help users understand disruption events, their impact on airports and airlines, and the operational implications.

Your knowledge comes from the DisruptionMatrix platform, which monitors global regions using autonomous agents that collect data from public sources (NOAA weather, FAA airport status, NASA EONET, USGS earthquakes, GDELT news, SafeAirspace.net, and more).

When answering:
1. Use ONLY the provided context to answer. Do not make up information.
2. If the context doesn't contain enough information, say so.
3. Reference specific events, airports, airlines, scores, and sources when relevant.
4. Mention the EDPS score and escalation level when discussing events.
5. If asked about flight impact, reference the OPS/impact assessment data.
6. Be concise but thorough. Use bullet points for lists.
7. If the user asks about something not in the context, suggest they check the Threat Board or specific event detail.

Format:
- Use **bold** for important terms (event names, airport codes, airline codes, scores)
- Use bullet points for lists
- Keep paragraphs short
- Cite sources like [Event: monsoon] or [Signal: wx-weather-R1-...] when referencing specific data`;

// ── Main conversation function ────────────────────────────────────
export async function chat(question, options = {}) {
  const { conversationHistory = [], docTypes = null, topK = 8 } = options;

  // 1. Retrieve relevant documents from RAG index
  const documents = await ragRetriever.retrieve(question, { topK, docTypes });

  // 2. Build context from retrieved documents
  const context = ragRetriever.buildContext(documents);

  // 3. Build messages for LLM
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Context from DisruptionMatrix knowledge base:\n\n${context || 'No relevant documents found in the knowledge base.'}` },
    ...conversationHistory.slice(-6), // keep last 6 messages for context
    { role: 'user', content: question },
  ];

  // 4. Call LLM (uses conversation-specific config, not prediction config)
  const llmResult = await llmService.chatCompletion(messages, {
    maxTokens: 800,
    temperature: 0.2,
    purpose: 'conversation',
  });

  if (!llmResult) {
    // LLM disabled — return a deterministic response based on retrieved docs
    return {
      answer: buildDeterministicAnswer(question, documents),
      sources: documents.map(d => ({ type: d.docType, id: d.sourceId })),
      documents: documents.length,
      llmEnabled: false,
      provider: null,
      model: null,
    };
  }

  return {
    answer: llmResult.content,
    sources: documents.map(d => ({ type: d.docType, id: d.sourceId, score: d.score })),
    documents: documents.length,
    llmEnabled: true,
    provider: llmResult.provider,
    model: llmResult.model,
  };
}

// ── Deterministic answer (when LLM is disabled) ──────────────────
function buildDeterministicAnswer(question, documents) {
  if (documents.length === 0) {
    return `I couldn't find any relevant information in the knowledge base for: "${question}".\n\nTry asking about:\n- Active disruption events (e.g., "What storms are affecting Bangalore?")\n- Airport details (e.g., "Tell me about BLR airport")\n- Airline exposure (e.g., "What's the impact on IndiGo?")\n- Agent status (e.g., "What agents are monitoring Europe?")\n\nNote: LLM is currently disabled. Enable it in Admin Settings for AI-powered answers.`;
  }

  const parts = [`Found ${documents.length} relevant documents for: "${question}"\n`];

  // Group by type
  const byType = {};
  for (const d of documents) {
    if (!byType[d.docType]) byType[d.docType] = [];
    byType[d.docType].push(d);
  }

  for (const [type, docs] of Object.entries(byType)) {
    parts.push(`\n**${type.toUpperCase()} (${docs.length}):**`);
    for (const d of docs.slice(0, 3)) {
      const firstLine = d.content.split('\n')[0];
      parts.push(`  • [${d.sourceId}] ${firstLine}`);
    }
    if (docs.length > 3) parts.push(`  ... and ${docs.length - 3} more`);
  }

  parts.push('\n*Note: LLM is disabled. Enable it in Admin Settings for AI-generated answers.*');
  return parts.join('\n');
}

// ── Get suggested questions based on current data ────────────────
export async function getSuggestedQuestions() {
  const suggestions = [];
  const { events } = store.getEvents({ limit: 100 });

  // Top-scoring event
  const topEvent = events.sort((a, b) => b.score - a.score)[0];
  if (topEvent) {
    suggestions.push(`What is the ${topEvent.name} event and what's its impact?`);
    suggestions.push(`Which airports are affected by ${topEvent.name}?`);
  }

  // High-escalation events
  const critical = events.filter((e) => e.esc >= 3);
  if (critical.length > 0) {
    suggestions.push(`What are the most critical threats right now?`);
  }

  // Category-based
  const cats = [...new Set(events.map((e) => e.cat))];
  if (cats.includes('Weather')) {
    suggestions.push(`What weather disruptions are active?`);
  }
  if (cats.includes('ATC / Airspace')) {
    suggestions.push(`Are there any ATC or airspace restrictions?`);
  }

  // General
  suggestions.push(`What agents are currently monitoring?`);
  suggestions.push(`Summarize the current threat landscape`);

  return suggestions.slice(0, 6);
}

export default { chat, getSuggestedQuestions };
