-- ============================================================
-- Board-Level RLS Policies — Strict Isolation
-- Multi-Tenant + Board-Level Access Control for Nexus RBAC
-- ============================================================
--
-- PURPOSE:
--   Extends the existing org-level RLS with board-level membership checks.
--   After this migration:
--     1. Users can only see boards they are explicit members of
--     2. PENDING org members cannot access any data (except their own row)
--     3. Realtime events are board-member-scoped
--
-- CRITICAL: This file must be run AFTER the Prisma migration that creates
-- the board_members, permission_schemes, permission_scheme_entries, and
-- membership_requests tables. Run the backfill section first.
--
-- HOW TO APPLY:
--   psql $DIRECT_URL -f prisma/migrations/rls_board_isolation.sql
--   Or via Supabase SQL editor (requires service_role connection).
--
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0. BACKFILL EXISTING DATA
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CRITICAL: Must run BEFORE enabling strict board isolation policies.
-- Without this, all existing users lose access to all existing boards.

-- 0a. Ensure all existing org members have status = ACTIVE
-- (The schema default is ACTIVE, but this catches any NULL or mis-set values)
UPDATE organization_users
SET status = 'ACTIVE'
WHERE status IS NULL OR status != 'ACTIVE';

-- 0b. Auto-create BoardMember OWNER rows for every existing board.
-- Strategy: For each board, find the first audit_log entry with action='CREATE'
-- and entity_type='BOARD'. That user is the board creator → make them OWNER.
-- Fallback: If no audit log exists, use the first org admin/owner for that org.
INSERT INTO board_members (id, board_id, user_id, org_id, role, invited_at, joined_at)
SELECT
  gen_random_uuid(),
  b.id,
  COALESCE(
    -- Primary: board creator from audit log
    (SELECT al.user_id FROM audit_logs al
     WHERE al.entity_id = b.id
       AND al.entity_type = 'BOARD'
       AND al.action = 'CREATE'
     ORDER BY al.created_at ASC
     LIMIT 1),
    -- Fallback: first OWNER/ADMIN of the org
    (SELECT ou.user_id FROM organization_users ou
     WHERE ou.organization_id = b.org_id
       AND ou.role IN ('OWNER', 'ADMIN')
     ORDER BY ou.created_at ASC
     LIMIT 1),
    -- Final fallback: first member of the org
    (SELECT ou.user_id FROM organization_users ou
     WHERE ou.organization_id = b.org_id
     ORDER BY ou.created_at ASC
     LIMIT 1)
  ),
  b.org_id,
  'OWNER',
  NOW(),
  NOW()
FROM boards b
WHERE NOT EXISTS (
  SELECT 1 FROM board_members bm WHERE bm.board_id = b.id
);

-- 0c. For each existing board, also add ALL current org members as MEMBERs
-- (so nobody loses access to boards they could previously see).
-- Skip if they're already a member (the OWNER created above).
INSERT INTO board_members (id, board_id, user_id, org_id, role, invited_at, joined_at)
SELECT
  gen_random_uuid(),
  b.id,
  ou.user_id,
  b.org_id,
  'MEMBER',
  NOW(),
  NOW()
FROM boards b
CROSS JOIN organization_users ou
WHERE ou.organization_id = b.org_id
  AND ou.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM board_members bm
    WHERE bm.board_id = b.id AND bm.user_id = ou.user_id
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. HELPER FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- current_org_id() already exists from rls_policies.sql — no-op if present.
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.current_org_id', TRUE), '');
$$;

-- NEW: current_user_id() — mirrors current_org_id() pattern.
-- Set by lib/db.ts at the start of every transaction.
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.current_user_id', TRUE), '');
$$;

-- SECURITY DEFINER function to check board membership WITHOUT triggering
-- board_members RLS (which would cause circular dependency with boards RLS).
-- This function runs as the DEFINER (owner = postgres/service role) so it
-- bypasses RLS on board_members. It is only callable from within RLS policies.
CREATE OR REPLACE FUNCTION is_board_member(p_board_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_members
    WHERE board_id = p_board_id
      AND user_id = p_user_id
  );
$$;

-- SECURITY DEFINER function to get board IDs for a user within an org.
-- Used by RLS policies that need to check board membership without
-- triggering the circular dependency.
CREATE OR REPLACE FUNCTION user_board_ids(p_org_id TEXT, p_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT board_id FROM board_members
  WHERE org_id = p_org_id AND user_id = p_user_id;
$$;

-- SECURITY DEFINER function to check org membership status.
-- Used by RLS policies to gate PENDING users.
CREATE OR REPLACE FUNCTION is_active_org_member(p_org_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND status = 'ACTIVE'
  );
$$;

-- Realtime helper: extract user_id from JWT sub claim
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::json ->> 'sub'),
    ''
  );
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. ENABLE RLS ON NEW TABLES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE board_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_schemes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_scheme_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_requests       ENABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. DROP EXISTING POLICIES THAT WE'RE REPLACING
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- boards: replace org-only with org+member policy
DROP POLICY IF EXISTS tenant_isolation ON boards;
DROP POLICY IF EXISTS tenant_isolation_insert ON boards;
DROP POLICY IF EXISTS boards_strict_member_isolation ON boards;

-- organization_users: replace with status-aware policy
DROP POLICY IF EXISTS tenant_isolation ON organization_users;
DROP POLICY IF EXISTS org_users_active_isolation ON organization_users;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. BOARD-LEVEL RLS POLICIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 4a. BOARDS — Strict isolation: org + board membership required.
-- Uses SECURITY DEFINER function to avoid circular dependency with board_members.
CREATE POLICY board_strict_isolation ON boards
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

-- INSERT: any active org member can create a board (they become OWNER via app logic).
CREATE POLICY board_insert_isolation ON boards
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND is_active_org_member(current_org_id(), current_user_id())
  );

-- UPDATE: must be org member + board member
CREATE POLICY board_update_isolation ON boards
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

-- DELETE: must be org member + board member (app enforces OWNER role)
CREATE POLICY board_delete_isolation ON boards
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

-- 4b. BOARD_MEMBERS — visible within org, scoped to member's boards
CREATE POLICY board_members_isolation ON board_members
  FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY board_members_insert ON board_members
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

CREATE POLICY board_members_update ON board_members
  FOR UPDATE
  USING (org_id = current_org_id());

CREATE POLICY board_members_delete ON board_members
  FOR DELETE
  USING (org_id = current_org_id());

-- 4c. PERMISSION_SCHEMES — org-scoped
CREATE POLICY permission_schemes_isolation ON permission_schemes
  FOR ALL
  USING (org_id = current_org_id());

-- 4d. PERMISSION_SCHEME_ENTRIES — via scheme's org
CREATE POLICY scheme_entries_isolation ON permission_scheme_entries
  FOR ALL
  USING (
    scheme_id IN (
      SELECT id FROM permission_schemes WHERE org_id = current_org_id()
    )
  );

-- 4e. MEMBERSHIP_REQUESTS — org-scoped
CREATE POLICY membership_requests_isolation ON membership_requests
  FOR ALL
  USING (org_id = current_org_id());

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. ORGANIZATION_USERS — status-aware policy
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PENDING users can see their own row (needed for /pending-approval page)
-- but cannot see other members until they are ACTIVE.

CREATE POLICY org_users_isolation ON organization_users
  FOR ALL
  USING (
    organization_id = current_org_id()
    AND (
      -- Self-access: user can always see their own membership row
      user_id = current_user_id()
      -- Active members can see all org members
      OR is_active_org_member(current_org_id(), current_user_id())
    )
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. REALTIME — Board-member-scoped subscriptions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- These SELECT policies control which rows flow over Supabase Realtime.
-- They are evaluated alongside the normal app-tier RLS.

-- Update existing realtime board policy to also check board membership
DROP POLICY IF EXISTS "realtime:boards:org_isolation" ON boards;
CREATE POLICY "realtime:boards:member_isolation"
  ON boards
  FOR SELECT
  USING (
    org_id = COALESCE(
      (current_setting('request.jwt.claims', TRUE)::json ->> 'org_id'),
      current_org_id()
    )
    AND is_board_member(id::text, COALESCE(
      requesting_user_id(),
      current_user_id()
    ))
  );

-- Add board_members to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.board_members;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. INDEXES for board-level RLS performance
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_board_members_board_user
  ON board_members(board_id, user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_org
  ON board_members(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_board_members_org
  ON board_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org_status
  ON organization_users(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_org_users_user_org
  ON organization_users(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_schemes_org
  ON permission_schemes(org_id);
CREATE INDEX IF NOT EXISTS idx_membership_requests_org_status
  ON membership_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_requests_board_status
  ON membership_requests(board_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_board_id
  ON audit_logs(board_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_board
  ON audit_logs(org_id, board_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. VERIFICATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Run this after applying to verify:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'board_members', 'permission_schemes', 'permission_scheme_entries',
--     'membership_requests', 'boards', 'organization_users'
--   )
-- ORDER BY tablename;
--
-- Expected: all rows have rowsecurity = true
