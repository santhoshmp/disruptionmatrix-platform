-- 006_event_archive.sql — Event archiving
-- Events that have passed and no longer threaten aviation are archived:
--   - score < 50 (below the moderate band), or
--   - no airports AND no airspace affected (no aviation-related threat), or
--   - detected > 72h ago with score < 65 (stale, decayed threat)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_events_archived ON events(archived);
