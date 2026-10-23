import pool from '../db/pool.js';

// Check what's in the RAG index
const counts = await pool.query('SELECT doc_type, COUNT(*) as count FROM rag_documents GROUP BY doc_type ORDER BY doc_type');
console.log('=== RAG index counts ===');
for (const r of counts.rows) console.log('  ' + r.doc_type + ': ' + r.count);

// Test full-text search
console.log('\n=== Full-text: critical threats ===');
const fts = await pool.query("SELECT doc_type, source_id, ts_rank(content_tsv, plainto_tsquery('english', 'critical threats')) as rank FROM rag_documents WHERE content_tsv @@ plainto_tsquery('english', 'critical threats') ORDER BY rank DESC LIMIT 10");
for (const r of fts.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ' (rank=' + Number(r.rank).toFixed(4) + ')');

console.log('\n=== Full-text: most critical threats right now ===');
const fts2 = await pool.query("SELECT doc_type, source_id, ts_rank(content_tsv, plainto_tsquery('english', 'most critical threats right now')) as rank FROM rag_documents WHERE content_tsv @@ plainto_tsquery('english', 'most critical threats right now') ORDER BY rank DESC LIMIT 10");
for (const r of fts2.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ' (rank=' + Number(r.rank).toFixed(4) + ')');

// Test trigram
console.log('\n=== Trigram: critical threats ===');
const tri = await pool.query("SELECT doc_type, source_id, similarity(content, 'critical threats') as sim FROM rag_documents WHERE similarity(content, 'critical threats') > 0.1 ORDER BY sim DESC LIMIT 10");
for (const r of tri.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ' (sim=' + Number(r.sim).toFixed(4) + ')');

// Check what an event doc looks like
console.log('\n=== Sample event doc ===');
const sample = await pool.query("SELECT doc_type, source_id, LEFT(content, 300) as preview FROM rag_documents WHERE doc_type = 'event' LIMIT 3");
for (const r of sample.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ': ' + r.preview);

// Check what a region doc looks like
console.log('\n=== Sample region doc ===');
const sampleR = await pool.query("SELECT doc_type, source_id, LEFT(content, 300) as preview FROM rag_documents WHERE doc_type = 'region' LIMIT 3");
for (const r of sampleR.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ': ' + r.preview);

// Check if events have "critical" or "threat" in their content
console.log('\n=== Events containing "critical" or "threat" ===');
const critEvents = await pool.query("SELECT doc_type, source_id, LEFT(content, 100) as preview FROM rag_documents WHERE doc_type = 'event' AND (content ILIKE '%critical%' OR content ILIKE '%threat%') LIMIT 5");
for (const r of critEvents.rows) console.log('  [' + r.doc_type + '] ' + r.source_id + ': ' + r.preview);

process.exit(0);
