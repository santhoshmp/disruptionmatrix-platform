-- 003_rag_layer.sql — RAG (Retrieval-Augmented Generation) layer
-- Stores searchable documents for the conversation agent.
-- Uses pg_trgm for BM25/fuzzy text search (always available).
-- Embeddings stored as JSONB (works locally without pgvector;
-- in Supabase production, can ALTER to use vector type if pgvector is enabled).

CREATE TABLE IF NOT EXISTS rag_documents (
  id          SERIAL PRIMARY KEY,
  doc_type    TEXT NOT NULL,           -- event | signal | ops | airport | airline | schedule | region | reference | agent
  source_id   TEXT NOT NULL,            -- original entity ID (e.g., "monsoon", "BLR", "6E")
  content     TEXT NOT NULL,            -- searchable text (the "document" for retrieval)
  metadata    JSONB DEFAULT '{}',      -- structured fields for filtering (score, category, airports, etc.)
  embedding   JSONB,                    -- embedding vector as array of floats (1536-dim for OpenAI)
  content_tsv TSVECTOR,                 -- pre-computed tsvector for full-text search
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doc_type, source_id)
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_rag_type        ON rag_documents (doc_type);
CREATE INDEX IF NOT EXISTS idx_rag_source_id   ON rag_documents (source_id);
CREATE INDEX IF NOT EXISTS idx_rag_metadata    ON rag_documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_rag_content_tsv ON rag_documents USING GIN (content_tsv);

-- pg_trgm index for fuzzy/keyword similarity search
CREATE INDEX IF NOT EXISTS idx_rag_content_trgm ON rag_documents USING GIN (content gin_trgm_ops);

-- Auto-update content_tsv on insert/update
CREATE OR REPLACE FUNCTION rag_update_tsv() RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv = to_tsvector('english', NEW.content);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_tsv ON rag_documents;
CREATE TRIGGER trg_rag_tsv BEFORE INSERT OR UPDATE ON rag_documents
  FOR EACH ROW EXECUTE FUNCTION rag_update_tsv();

-- Enable pgvector if available (Supabase has it; local may not)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  -- If vector extension exists, add a proper vector column
  BEGIN
    ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- pgvector not available, use JSONB embedding column instead
  END;
EXCEPTION WHEN OTHERS THEN
  NULL; -- pgvector extension not available
END $$;
