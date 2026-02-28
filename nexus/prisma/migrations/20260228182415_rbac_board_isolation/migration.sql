-- CreateEnum
CREATE TYPE "BoardRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "BoardPermission" AS ENUM ('BOARD_VIEW', 'BOARD_EDIT_SETTINGS', 'BOARD_DELETE', 'BOARD_SHARE', 'BOARD_MANAGE_MEMBERS', 'LIST_CREATE', 'LIST_EDIT', 'LIST_DELETE', 'LIST_REORDER', 'CARD_CREATE', 'CARD_VIEW', 'CARD_EDIT', 'CARD_DELETE', 'CARD_MOVE', 'CARD_ASSIGN', 'CARD_COMMENT', 'CARD_EDIT_OWN_COMMENT', 'CARD_DELETE_OWN_COMMENT', 'CARD_DELETE_ANY_COMMENT', 'FIELD_DESCRIPTION_VIEW', 'FIELD_STORY_POINTS_VIEW', 'FIELD_TIME_TRACKING_VIEW', 'FIELD_ATTACHMENTS_VIEW', 'FIELD_CUSTOM_FIELDS_VIEW', 'AUTOMATION_VIEW', 'AUTOMATION_MANAGE', 'ANALYTICS_VIEW', 'ANALYTICS_EXPORT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MembershipRequestType" AS ENUM ('ORG_MEMBERSHIP', 'BOARD_ACCESS');

-- AlterEnum
ALTER TYPE "ACTION" ADD VALUE 'MEMBER_INVITED';
ALTER TYPE "ACTION" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "ACTION" ADD VALUE 'MEMBER_REMOVED';
ALTER TYPE "ACTION" ADD VALUE 'MEMBER_ROLE_CHANGED';
ALTER TYPE "ACTION" ADD VALUE 'MEMBER_STATUS_CHANGED';
ALTER TYPE "ACTION" ADD VALUE 'BOARD_MEMBER_ADDED';
ALTER TYPE "ACTION" ADD VALUE 'BOARD_MEMBER_REMOVED';
ALTER TYPE "ACTION" ADD VALUE 'BOARD_MEMBER_ROLE_CHANGED';
ALTER TYPE "ACTION" ADD VALUE 'PERMISSION_SCHEME_CREATED';
ALTER TYPE "ACTION" ADD VALUE 'PERMISSION_SCHEME_UPDATED';
ALTER TYPE "ACTION" ADD VALUE 'PERMISSION_SCHEME_DELETED';
ALTER TYPE "ACTION" ADD VALUE 'PERMISSION_SCHEME_ASSIGNED';
ALTER TYPE "ACTION" ADD VALUE 'ACCESS_REQUESTED';
ALTER TYPE "ACTION" ADD VALUE 'ACCESS_APPROVED';
ALTER TYPE "ACTION" ADD VALUE 'ACCESS_REJECTED';
ALTER TYPE "ACTION" ADD VALUE 'ACCESS_DENIED';
ALTER TYPE "ACTION" ADD VALUE 'API_KEY_CREATED';
ALTER TYPE "ACTION" ADD VALUE 'API_KEY_REVOKED';

-- AlterEnum
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'BOARD_MEMBER';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'ORG_MEMBER';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'PERMISSION_SCHEME';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'API_KEY';
ALTER TYPE "ENTITY_TYPE" ADD VALUE 'MEMBERSHIP_REQUEST';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "board_id" TEXT,
ADD COLUMN     "new_values" JSONB,
ADD COLUMN     "previous_values" JSONB;

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permission_scheme_id" TEXT;

-- AlterTable
ALTER TABLE "organization_users" ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "board_members" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL DEFAULT 'MEMBER',
    "permission_scheme_id" TEXT,
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_schemes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_scheme_entries" (
    "id" TEXT NOT NULL,
    "scheme_id" TEXT NOT NULL,
    "role" "BoardRole" NOT NULL,
    "permission" "BoardPermission" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "permission_scheme_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "MembershipRequestType" NOT NULL,
    "board_id" TEXT,
    "requested_role" "BoardRole" NOT NULL DEFAULT 'MEMBER',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_members_board_id_idx" ON "board_members"("board_id");

-- CreateIndex
CREATE INDEX "board_members_user_id_idx" ON "board_members"("user_id");

-- CreateIndex
CREATE INDEX "board_members_org_id_idx" ON "board_members"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_board_id_user_id_key" ON "board_members"("board_id", "user_id");

-- CreateIndex
CREATE INDEX "permission_schemes_org_id_idx" ON "permission_schemes"("org_id");

-- CreateIndex
CREATE INDEX "permission_scheme_entries_scheme_id_role_idx" ON "permission_scheme_entries"("scheme_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "permission_scheme_entries_scheme_id_role_permission_key" ON "permission_scheme_entries"("scheme_id", "role", "permission");

-- CreateIndex
CREATE INDEX "membership_requests_org_id_status_idx" ON "membership_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "membership_requests_user_id_idx" ON "membership_requests"("user_id");

-- CreateIndex
CREATE INDEX "membership_requests_board_id_status_idx" ON "membership_requests"("board_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_board_id_idx" ON "audit_logs"("board_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_entity_id_createdAt_idx" ON "audit_logs"("org_id", "entity_id", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "organization_users_organization_id_status_idx" ON "organization_users"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_permission_scheme_id_fkey" FOREIGN KEY ("permission_scheme_id") REFERENCES "permission_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_schemes" ADD CONSTRAINT "permission_schemes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_scheme_entries" ADD CONSTRAINT "permission_scheme_entries_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "permission_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_permission_scheme_id_fkey" FOREIGN KEY ("permission_scheme_id") REFERENCES "permission_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===========================================================
-- BACKFILL EXISTING DATA
-- ===========================================================
-- CRITICAL: Runs BEFORE RLS policies. Without this, existing
-- users lose access to existing boards.

-- Ensure existing org members are ACTIVE
UPDATE organization_users
SET status = 'ACTIVE'
WHERE status IS NULL OR status != 'ACTIVE';

-- Auto-create BoardMember OWNER rows for every existing board
INSERT INTO board_members (id, board_id, user_id, org_id, role, invited_at, joined_at)
SELECT
  gen_random_uuid(),
  b.id,
  COALESCE(
    (SELECT al.user_id FROM audit_logs al
     WHERE al.entity_id = b.id
       AND al.entity_type = 'BOARD'
       AND al.action = 'CREATE'
     ORDER BY al."createdAt" ASC
     LIMIT 1),
    (SELECT ou.user_id FROM organization_users ou
     WHERE ou.organization_id = b.org_id
       AND ou.role IN ('OWNER', 'ADMIN')
     ORDER BY ou.created_at ASC
     LIMIT 1),
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

-- Add ALL current org members as MEMBERs to every board (so nobody loses access)
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

-- ===========================================================
-- HELPER FUNCTIONS
-- ===========================================================

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.current_org_id', TRUE), '');
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.current_user_id', TRUE), '');
$$;

-- SECURITY DEFINER: checks board membership without triggering board_members RLS
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

-- SECURITY DEFINER: gets all board IDs for a user in an org
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

-- SECURITY DEFINER: checks if user is ACTIVE org member
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

-- Realtime: extract user_id from JWT sub claim
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', TRUE)::json ->> 'sub'),
    ''
  );
$$;

-- ===========================================================
-- ENABLE RLS ON NEW TABLES
-- ===========================================================

ALTER TABLE board_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_schemes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_scheme_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_requests       ENABLE ROW LEVEL SECURITY;

-- ===========================================================
-- DROP OLD POLICIES (replacing with board-aware versions)
-- ===========================================================

DROP POLICY IF EXISTS tenant_isolation ON boards;
DROP POLICY IF EXISTS tenant_isolation_insert ON boards;
DROP POLICY IF EXISTS boards_strict_member_isolation ON boards;
DROP POLICY IF EXISTS tenant_isolation ON organization_users;
DROP POLICY IF EXISTS org_users_active_isolation ON organization_users;

-- ===========================================================
-- BOARD-LEVEL RLS POLICIES
-- ===========================================================

-- BOARDS: Strict isolation - org + board membership required
CREATE POLICY board_strict_isolation ON boards
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

CREATE POLICY board_insert_isolation ON boards
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND is_active_org_member(current_org_id(), current_user_id())
  );

CREATE POLICY board_update_isolation ON boards
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

CREATE POLICY board_delete_isolation ON boards
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND is_board_member(id::text, current_user_id())
  );

-- BOARD_MEMBERS: org-scoped
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

-- PERMISSION_SCHEMES: org-scoped
CREATE POLICY permission_schemes_select ON permission_schemes
  FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY permission_schemes_insert ON permission_schemes
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

CREATE POLICY permission_schemes_update ON permission_schemes
  FOR UPDATE
  USING (org_id = current_org_id());

CREATE POLICY permission_schemes_delete ON permission_schemes
  FOR DELETE
  USING (org_id = current_org_id());

-- PERMISSION_SCHEME_ENTRIES: via scheme's org
CREATE POLICY scheme_entries_select ON permission_scheme_entries
  FOR SELECT
  USING (
    scheme_id IN (
      SELECT id FROM permission_schemes WHERE org_id = current_org_id()
    )
  );

CREATE POLICY scheme_entries_insert ON permission_scheme_entries
  FOR INSERT
  WITH CHECK (
    scheme_id IN (
      SELECT id FROM permission_schemes WHERE org_id = current_org_id()
    )
  );

CREATE POLICY scheme_entries_update ON permission_scheme_entries
  FOR UPDATE
  USING (
    scheme_id IN (
      SELECT id FROM permission_schemes WHERE org_id = current_org_id()
    )
  );

CREATE POLICY scheme_entries_delete ON permission_scheme_entries
  FOR DELETE
  USING (
    scheme_id IN (
      SELECT id FROM permission_schemes WHERE org_id = current_org_id()
    )
  );

-- MEMBERSHIP_REQUESTS: org-scoped
CREATE POLICY membership_requests_select ON membership_requests
  FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY membership_requests_insert ON membership_requests
  FOR INSERT
  WITH CHECK (org_id = current_org_id());

CREATE POLICY membership_requests_update ON membership_requests
  FOR UPDATE
  USING (org_id = current_org_id());

CREATE POLICY membership_requests_delete ON membership_requests
  FOR DELETE
  USING (org_id = current_org_id());

-- ===========================================================
-- ORGANIZATION_USERS: status-aware policy
-- ===========================================================
-- PENDING users can see their own row only.
-- ACTIVE users can see all members.

CREATE POLICY org_users_isolation ON organization_users
  FOR SELECT
  USING (
    organization_id = current_org_id()
    AND (
      user_id = current_user_id()
      OR is_active_org_member(current_org_id(), current_user_id())
    )
  );

CREATE POLICY org_users_insert ON organization_users
  FOR INSERT
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_users_update ON organization_users
  FOR UPDATE
  USING (organization_id = current_org_id());

CREATE POLICY org_users_delete ON organization_users
  FOR DELETE
  USING (organization_id = current_org_id());

-- ===========================================================
-- REALTIME: board-member-scoped
-- ===========================================================

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

-- ===========================================================
-- ADDITIONAL INDEXES for RLS performance
-- ===========================================================

CREATE INDEX IF NOT EXISTS idx_board_members_board_user
  ON board_members(board_id, user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_org
  ON board_members(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_user_org
  ON organization_users(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_board
  ON audit_logs(org_id, board_id);
