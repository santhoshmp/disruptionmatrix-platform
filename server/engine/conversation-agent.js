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
      sources: documents.map(d => ({ type: d.docType, id: d.sourceId, title: extractTitle(d) })),
      documents: documents.length,
      llmEnabled: false,
      provider: null,
      model: null,
    };
  }

  return {
    answer: llmResult.content,
    sources: documents.map(d => ({ type: d.docType, id: d.sourceId, title: extractTitle(d), score: d.score })),
    documents: documents.length,
    llmEnabled: true,
    provider: llmResult.provider,
    model: llmResult.model,
  };
}

// Extract a human-readable title from a document
function extractTitle(doc) {
  const firstLine = doc.content?.split('\n')[0] || doc.sourceId;
  // Remove "Event: ", "Signal: ", "Region: " etc. prefix
  return firstLine.replace(/^[A-Z][a-z]+:\s*/, '');
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
  const { events } = store.getEvents({ limit: 500 });

  if (events.length === 0) return suggestions;

  const sorted = [...events].sort((a, b) => b.score - a.score);
  const topEvent = sorted[0];
  const secondEvent = sorted[1];
  const critical = events.filter((e) => e.esc >= 4);
  const escalating = events.filter((e) => e.traj === 'Escalating');

  // ── Critical / overview questions ──
  suggestions.push('What are the most critical threats right now?');
  if (escalating.length > 0) {
    suggestions.push(`${escalating.length} events are escalating — which ones need attention?`);
  }
  suggestions.push('Summarize the current threat landscape');

  // ── Top event specific ──
  if (topEvent) {
    suggestions.push(`What is the ${topEvent.name} and what's its impact?`);
    suggestions.push(`Which airports and airlines are affected by ${topEvent.name}?`);
  }

  // ── Category-based ──
  const cats = [...new Set(events.map((e) => e.cat))];
  const catCounts = {};
  for (const e of events) catCounts[e.cat] = (catCounts[e.cat] || 0) + 1;

  if (cats.includes('Weather')) {
    suggestions.push('What weather disruptions are currently active?');
  }
  if (cats.includes('ATC / Airspace')) {
    suggestions.push('Are there any ATC or airspace restrictions?');
  }
  if (cats.includes('Industrial action')) {
    suggestions.push('Which industrial actions or strikes are affecting flights?');
  }
  if (cats.includes('Infrastructure')) {
    suggestions.push('Are there any infrastructure failures affecting airports?');
  }
  if (cats.includes('Geopolitical')) {
    suggestions.push('What geopolitical events are impacting airspace?');
  }
  if (cats.includes('Regulatory')) {
    suggestions.push('Are there any regulatory changes affecting operations?');
  }

  // ── Airport / region specific ──
  const airports = new Set();
  for (const e of events) {
    for (const a of (e._airports || [])) airports.add(a);
  }
  const airportList = [...airports];
  if (airportList.includes('BLR')) suggestions.push('What disruptions are affecting BLR airport?');
  if (airportList.includes('BOM')) suggestions.push('What\'s happening at BOM airport?');
  if (airportList.includes('FRA')) suggestions.push('How is FRA affected by current events?');

  // ── Escalating events ──
  if (escalating.length >= 2) {
    const topEscalating = escalating.sort((a, b) => b.score - a.score)[0];
    if (topEscalating && topEscalating.id !== topEvent?.id) {
      suggestions.push(`Why is ${topEscalating.name} escalating?`);
    }
  }

  // ── Agent / monitoring ──
  suggestions.push('What agents are currently monitoring and what regions?');
  suggestions.push('What data sources are the agents using?');

  // ── Impact / airline ──
  if (secondEvent && secondEvent.id !== topEvent?.id) {
    suggestions.push(`Compare the impact of ${topEvent.name} vs ${secondEvent.name}`);
  }
  suggestions.push('Which airports have the highest disruption exposure?');

  // Deduplicate and return top 12
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 12);
}

export default { chat, getSuggestedQuestions };
