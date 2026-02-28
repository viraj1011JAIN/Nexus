-- ─────────────────────────────────────────────────────────────────────────────
-- TASK-024: Full-Text Search — PostgreSQL GIN index on Card title + description
-- ─────────────────────────────────────────────────────────────────────────────

-- Generated search column (stored, always up-to-date via trigger in practice,
-- but GIN over expression index is simpler and zero-maintenance):
CREATE INDEX IF NOT EXISTS cards_fts_idx
  ON cards USING gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  );

-- Separate lightweight index for prefix / trigram searches on title alone
-- (requires pg_trgm extension, available on Supabase by default)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS cards_title_trgm_idx
  ON cards USING gin (title gin_trgm_ops);
