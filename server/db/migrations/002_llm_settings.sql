-- 002_llm_settings.sql — LLM provider settings table

CREATE TABLE IF NOT EXISTS llm_settings (
  id              SERIAL PRIMARY KEY,
  provider        TEXT NOT NULL,           -- 'openai' | 'anthropic' | 'azure' | 'google' | 'mistral'
  api_key         TEXT,                    -- encrypted in production; stored as plaintext for dev
  api_base        TEXT,                    -- custom endpoint (optional, for Azure/proxy)
  model           TEXT,                    -- default model name (e.g. 'gpt-4o', 'claude-sonnet-4-20250514')
  enabled         BOOLEAN DEFAULT false,   -- per-provider enable flag
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider)
);

-- Global LLM on/off flag (stored in settings table as key-value)
INSERT INTO settings (key, value)
VALUES ('llm_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Default active provider (which provider to use when LLM is on)
INSERT INTO settings (key, value)
VALUES ('llm_active_provider', 'openai')
ON CONFLICT (key) DO NOTHING;
