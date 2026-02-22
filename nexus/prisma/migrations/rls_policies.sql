-- ============================================================
-- Row-Level Security (RLS) Policies
-- Multi-Tenant Isolation for Nexus
-- ============================================================
--
-- PURPOSE:
--   Enforce tenant isolation at the database layer.
--   Even if application-layer bugs exist (e.g. a compromised server action),
--   these policies guarantee a query for Org A can never return data for Org B.
--
-- ARCHITECTURE:
--   - The app role (DATABASE_URL / pg_application_user) has SELECT/INSERT/UPDATE/DELETE
--     on all tables but is ALWAYS subject to RLS.
--   - The service role (SYSTEM_DATABASE_URL / postgres superuser) bypasses RLS.
--     Only Stripe webhooks and cron jobs use it.
--   - RLS reads the current session variable `app.current_org_id` which the
--     application sets at the start of every transaction.
--     NOTE: If setting session variables per-transaction is not implemented,
--     fall back to PERMISSIVE policies that require data to match the JWT claims.
--
-- HOW TO APPLY:
--   1. psql $DIRECT_URL -f prisma/migrations/rls_policies.sql
--   Or via Supabase SQL editor (requires service_role connection).
--
-- ============================================================

-- ── Helper function ────────────────────────────────────────────────────────
-- Returns the current org ID from a session variable set by the application tier.
-- Falls back to empty string (no access) if not set.

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_org_id', TRUE),
    ''
  );
$$;

-- ── Enable RLS on all tenant-scoped tables ─────────────────────────────────

ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users  ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels               ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_analytics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analytics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_snapshots   ENABLE ROW LEVEL SECURITY;

-- Also enable on tables WITHOUT direct org_id (isolated via FK chains)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies before recreating ──────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations', 'organization_users', 'boards', 'lists', 'cards',
    'labels', 'card_label_assignments', 'comments', 'comment_reactions',
    'audit_logs', 'board_analytics', 'user_analytics', 'activity_snapshots',
    'users'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', t);
  END LOOP;
END $$;

-- ── organizations ──────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON organizations
  FOR ALL
  USING (id = current_org_id());

-- ── organization_users ────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON organization_users
  FOR ALL
  USING (organization_id = current_org_id());

-- ── boards ────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON boards
  FOR ALL
  USING (org_id = current_org_id());

CREATE POLICY tenant_isolation_insert ON boards
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

-- ── lists ─────────────────────────────────────────────────────────────────
-- Lists have no org_id; derive from board.

CREATE POLICY tenant_isolation ON lists
  FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE org_id = current_org_id()
    )
  );

-- ── cards ─────────────────────────────────────────────────────────────────
-- Cards have no org_id; derive via list → board.

CREATE POLICY tenant_isolation ON cards
  FOR ALL
  USING (
    list_id IN (
      SELECT l.id FROM lists l
      JOIN boards b ON b.id = l.board_id
      WHERE b.org_id = current_org_id()
    )
  );

-- ── labels ────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON labels
  FOR ALL
  USING (org_id = current_org_id());

CREATE POLICY tenant_isolation_insert ON labels
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

-- ── card_label_assignments ────────────────────────────────────────────────
-- Derive org from card → list → board.

CREATE POLICY tenant_isolation ON card_label_assignments
  FOR ALL
  USING (
    card_id IN (
      SELECT c.id FROM cards c
      JOIN lists l ON l.id = c.list_id
      JOIN boards b ON b.id = l.board_id
      WHERE b.org_id = current_org_id()
    )
  );

-- ── comments ─────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON comments
  FOR ALL
  USING (
    card_id IN (
      SELECT c.id FROM cards c
      JOIN lists l ON l.id = c.list_id
      JOIN boards b ON b.id = l.board_id
      WHERE b.org_id = current_org_id()
    )
  );

-- ── comment_reactions ─────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON comment_reactions
  FOR ALL
  USING (
    comment_id IN (
      SELECT co.id FROM comments co
      JOIN cards c ON c.id = co.card_id
      JOIN lists l ON l.id = c.list_id
      JOIN boards b ON b.id = l.board_id
      WHERE b.org_id = current_org_id()
    )
  );

-- ── audit_logs ────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON audit_logs
  FOR ALL
  USING (org_id = current_org_id());

-- ── board_analytics ───────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON board_analytics
  FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE org_id = current_org_id()
    )
  );

-- ── user_analytics ────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON user_analytics
  FOR ALL
  USING (org_id = current_org_id());

-- ── activity_snapshots ────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON activity_snapshots
  FOR ALL
  USING (org_id = current_org_id());

-- ── users ────────────────────────────────────────────────────────────────
-- Users are visible if they are a member of the current org.

CREATE POLICY tenant_isolation ON users
  FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM organization_users
      WHERE organization_id = current_org_id()
    )
  );

-- ── Indexes to support RLS policy lookups ────────────────────────────────
-- These ensure the sub-selects in policies use index scans, not seq scans.

CREATE INDEX IF NOT EXISTS idx_boards_org_id          ON boards(org_id);
CREATE INDEX IF NOT EXISTS idx_lists_board_id          ON lists(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_list_id           ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_labels_org_id           ON labels(org_id);
CREATE INDEX IF NOT EXISTS idx_card_label_card_id      ON card_label_assignments(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_card_id        ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment_id    ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id       ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_board_analytics_board_id ON board_analytics(board_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_org_id   ON user_analytics(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_snapshots_org  ON activity_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org_id        ON organization_users(organization_id);

-- ============================================================
-- VERIFICATION QUERY
-- Run this after applying to confirm RLS is enabled on all tables.
-- Expected: all rows have rowsecurity = true
-- ============================================================

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'organizations', 'organization_users', 'boards', 'lists', 'cards',
--     'labels', 'card_label_assignments', 'comments', 'comment_reactions',
--     'audit_logs', 'board_analytics', 'user_analytics', 'activity_snapshots',
--     'users'
--   )
-- ORDER BY tablename;

-- ============================================================
-- SUPABASE REALTIME — JWT-GATED PUBLICATION POLICIES
--
-- Purpose: Ensure Supabase Realtime only delivers rows to clients
--          whose bearer JWT carries the matching org_id claim.
--
-- How it works:
--   1. Supabase Realtime reads the `realtime` publication.
--   2. For each CDC event the `realtime.messages` row-level check
--      function (set via publication policy) is evaluated.
--   3. We extract `org_id` from the JWT and compare it to the
--      row's org_id column; events from other tenants are dropped.
--
-- Prerequisites:
--   • A Supabase JWT template in Clerk that adds `org_id` to the
--     token payload (Settings → JWT Templates → "supabase").
--   • The client passes that token as the Authorization header
--     when creating the Supabase client (see lib/supabase/client.ts).
--
-- ============================================================

-- Ensure the realtime schema exists (it does in hosted Supabase).
-- This is a no-op on Supabase cloud; only needed for local dev.
CREATE SCHEMA IF NOT EXISTS realtime;

-- Add the tables we emit realtime events for to the publication.
-- Using `FOR TABLE` instead of `FOR ALL TABLES` limits exposure.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE
      public.boards,
      public.lists,
      public.cards,
      public.comments,
      public.comment_reactions;
  END IF;
END;
$$;

-- Alter publication to add any missing tables (idempotent).
-- Run individually if the DO block above skipped (publication already exists).
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.lists;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.comment_reactions;

-- ────────────────────────────────────────────────────────────
-- Helper: extract org_id from the current Supabase/JWT session.
--
-- CLERK JWT TEMPLATE SETUP (Clerk Dashboard → JWT Templates → Supabase)
-- The template MUST include this claim with EXACTLY this key name:
--
--   { "org_id": "{{org.id}}" }
--
-- This function reads:  current_setting('request.jwt.claims')::jsonb ->> 'org_id'
-- If the claim key in Clerk is 'organization_id', 'orgId', or anything other than
-- 'org_id', this function returns NULL and ALL Realtime policies silently drop every
-- event (zero rows match, no error is raised).
--
-- END-TO-END VERIFICATION after configuring the template:
--   1. Sign in to the app and open a board.
--   2. In the browser console, confirm no "No JWT template" errors.
--   3. In a second browser tab, make a card change.
--   4. Confirm the first tab receives the Realtime event without a page refresh.
--   If events don't arrive: check Supabase → Realtime → Inspector logs and
--   verify the JWT claim key is exactly 'org_id'.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.requesting_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb ->> 'org_id',
    ''
  );
$$;

-- ────────────────────────────────────────────────────────────
-- Realtime RLS policies — one per table in the publication.
-- These SELECT policies control which rows flow over Realtime.
-- They are evaluated in addition to (not instead of) the normal
-- app RLS policies defined above.
-- ────────────────────────────────────────────────────────────

-- boards
DROP POLICY IF EXISTS "realtime:boards:org_isolation" ON public.boards;
CREATE POLICY "realtime:boards:org_isolation"
  ON public.boards
  FOR SELECT
  USING (
    org_id = public.requesting_org_id()
  );

-- lists  (inherit tenant scope via board)
DROP POLICY IF EXISTS "realtime:lists:org_isolation" ON public.lists;
CREATE POLICY "realtime:lists:org_isolation"
  ON public.lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = public.lists.board_id
        AND b.org_id = public.requesting_org_id()
    )
  );

-- cards  (inherit tenant scope via list → board)
DROP POLICY IF EXISTS "realtime:cards:org_isolation" ON public.cards;
CREATE POLICY "realtime:cards:org_isolation"
  ON public.cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.lists l
        JOIN public.boards b ON b.id = l.board_id
       WHERE l.id = public.cards.list_id
         AND b.org_id = public.requesting_org_id()
    )
  );

-- comments  (inherit via card → list → board)
DROP POLICY IF EXISTS "realtime:comments:org_isolation" ON public.comments;
CREATE POLICY "realtime:comments:org_isolation"
  ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.cards c
        JOIN public.lists l  ON l.id  = c.list_id
        JOIN public.boards b ON b.id  = l.board_id
       WHERE c.id = public.comments.card_id
         AND b.org_id = public.requesting_org_id()
    )
  );

-- comment_reactions  (inherit via comment → card → … → board)
DROP POLICY IF EXISTS "realtime:reactions:org_isolation" ON public.comment_reactions;
CREATE POLICY "realtime:reactions:org_isolation"
  ON public.comment_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.comments cm
        JOIN public.cards c  ON c.id  = cm.card_id
        JOIN public.lists l  ON l.id  = c.list_id
        JOIN public.boards b ON b.id  = l.board_id
       WHERE cm.id = public.comment_reactions.comment_id
         AND b.org_id = public.requesting_org_id()
    )
  );
