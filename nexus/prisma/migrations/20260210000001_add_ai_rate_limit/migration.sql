-- ─────────────────────────────────────────────────────────────────────────────
-- TASK-022: Add AI rate-limiting columns to organizations table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_calls_today   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_calls_reset_at TIMESTAMP WITH TIME ZONE;
