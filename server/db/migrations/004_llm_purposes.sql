-- 004_llm_purposes.sql — Separate LLM settings for different purposes
-- Adds a "purpose" column to llm_settings so admins can configure
-- different providers/models for:
--   'prediction'  — event scoring, signal enrichment, correlation reasoning (higher complexity)
--   'conversation' — RAG-powered chat assistant (lower complexity, cheaper)
--
-- Also adds settings keys for per-purpose active provider selection.

-- Add purpose column (defaults to 'prediction' for backward compat)
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'prediction';

-- Drop the old unique(provider) constraint and replace with unique(provider, purpose)
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_provider_key;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_provider_key1;

-- Add new unique constraint: provider + purpose must be unique
DO $$
BEGIN
  -- Update existing rows to have purpose = 'prediction'
  UPDATE llm_settings SET purpose = 'prediction' WHERE purpose IS NULL;

  -- Add unique constraint on (provider, purpose)
  BEGIN
    ALTER TABLE llm_settings ADD CONSTRAINT llm_settings_provider_purpose_key UNIQUE (provider, purpose);
  EXCEPTION WHEN duplicate_table THEN
    NULL; -- constraint already exists
  END;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Settings keys for per-purpose active provider
INSERT INTO settings (key, value)
VALUES ('llm_conversation_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('llm_conversation_active_provider', 'openai')
ON CONFLICT (key) DO NOTHING;

-- Rename existing active provider setting for clarity (keep old key for backward compat)
-- llm_active_provider → used for prediction
-- llm_conversation_active_provider → used for conversation
