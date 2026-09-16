// rag.js — Repository for RAG documents (rag_documents table)
// CRUD operations for the retrieval-augmented generation index.

import pool from '../pool.js';

// ── Upsert a single document ─────────────────────────────────────
export async function upsertDocument({ docType, sourceId, content, metadata = {}, embedding = null }) {
  await pool.query(`
    INSERT INTO rag_documents (doc_type, source_id, content, metadata, embedding)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (doc_type, source_id) DO UPDATE
    SET content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
  `, [docType, sourceId, content, JSON.stringify(metadata), embedding ? JSON.stringify(embedding) : null]);
}

// ── Batch upsert ─────────────────────────────────────────────────
export async function upsertBatch(documents) {
  for (const doc of documents) {
    await upsertDocument(doc);
  }
}

// ── Delete by source ID ──────────────────────────────────────────
export async function deleteDocument(docType, sourceId) {
  await pool.query('DELETE FROM rag_documents WHERE doc_type = $1 AND source_id = $2', [docType, sourceId]);
}

// ── Delete all documents of a type ──────────────────────────────
export async function deleteByType(docType) {
  await pool.query('DELETE FROM rag_documents WHERE doc_type = $1', [docType]);
}

// ── Get document counts by type ─────────────────────────────────
export async function getCounts() {
  const res = await pool.query(`
    SELECT doc_type, COUNT(*) as count
    FROM rag_documents
    GROUP BY doc_type
    ORDER BY doc_type
  `);
  return res.rows.reduce((acc, r) => { acc[r.doc_type] = parseInt(r.count, 10); return acc; }, {});
}

// ── Full-text search (tsvector) ──────────────────────────────────
// Uses PostgreSQL's built-in full-text search with ts_rank
export async function searchFullText(query, options = {}) {
  const { limit = 10, docTypes = null } = options;
  const params = [query, limit];
  let typeFilter = '';
  if (docTypes && docTypes.length > 0) {
    params.push(docTypes);
    typeFilter = 'AND doc_type = ANY($3)';
  }

  const res = await pool.query(`
    SELECT id, doc_type, source_id, content, metadata,
           ts_rank(content_tsv, plainto_tsquery('english', $1)) as rank
    FROM rag_documents
    WHERE content_tsv @@ plainto_tsquery('english', $1)
    ${typeFilter}
    ORDER BY rank DESC
    LIMIT $2
  `, params);

  return res.rows.map(r => ({
    id: r.id,
    docType: r.doc_type,
    sourceId: r.source_id,
    content: r.content,
    metadata: r.metadata,
    score: r.rank,
  }));
}

// ── Trigram similarity search (pg_trgm) ──────────────────────────
// Good for fuzzy keyword matching
export async function searchTrigram(query, options = {}) {
  const { limit = 10, docTypes = null, threshold = 0.1 } = options;
  const params = [query, limit, threshold];
  let typeFilter = '';
  if (docTypes && docTypes.length > 0) {
    params.push(docTypes);
    typeFilter = 'AND doc_type = ANY($4)';
  }

  const res = await pool.query(`
    SELECT id, doc_type, source_id, content, metadata,
           similarity(content, $1) as sim
    FROM rag_documents
    WHERE similarity(content, $1) > $3
    ${typeFilter}
    ORDER BY sim DESC
    LIMIT $2
  `, params);

  return res.rows.map(r => ({
    id: r.id,
    docType: r.doc_type,
    sourceId: r.source_id,
    content: r.content,
    metadata: r.metadata,
    score: r.sim,
  }));
}

// ── Get all documents with embeddings (for JS-side vector search) ─
export async function getDocumentsWithEmbeddings(docTypes = null) {
  const params = [];
  let typeFilter = '';
  if (docTypes && docTypes.length > 0) {
    params.push(docTypes);
    typeFilter = 'WHERE embedding IS NOT NULL AND doc_type = ANY($1)';
  } else {
    typeFilter = 'WHERE embedding IS NOT NULL';
  }

  const res = await pool.query(`
    SELECT id, doc_type, source_id, content, metadata, embedding
    FROM rag_documents
    ${typeFilter}
  `, params);

  return res.rows.map(r => ({
    id: r.id,
    docType: r.doc_type,
    sourceId: r.source_id,
    content: r.content,
    metadata: r.metadata,
    embedding: r.embedding,
  }));
}

// ── Get all documents (for re-indexing) ─────────────────────────
export async function getAll(docType = null) {
  const params = [];
  let where = '';
  if (docType) {
    params.push(docType);
    where = 'WHERE doc_type = $1';
  }
  const res = await pool.query(`
    SELECT id, doc_type, source_id, content, metadata, updated_at
    FROM rag_documents
    ${where}
    ORDER BY updated_at DESC
  `, params);
  return res.rows;
}

export default {
  upsertDocument,
  upsertBatch,
  deleteDocument,
  deleteByType,
  getCounts,
  searchFullText,
  searchTrigram,
  getDocumentsWithEmbeddings,
  getAll,
};
