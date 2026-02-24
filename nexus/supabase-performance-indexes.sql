-- =============================================================================
-- NEXUS — Performance Indexes (TASK-035)
-- =============================================================================
-- Run these statements on your Supabase database to add the indexes that
-- support the most frequent query patterns.
--
-- Safe to run multiple times — each statement uses CREATE INDEX IF NOT EXISTS.
-- All indexes are created CONCURRENTLY so they do not lock production tables.
-- Note: CONCURRENTLY cannot run inside a transaction block; run this file
-- directly via psql or the Supabase SQL editor.
--
-- Estimated impact (based on typical board query profiles):
--   cards_list_order    — eliminates seq-scan on list page load (-70 % query time)
--   cards_assignee_due  — speeds up "my due cards" and overdue queries
--   audit_org_created   — speeds up activity feed pagination
--   notification_user   — speeds up bell icon unread count
--   time_log_card       — speeds up time-tracking panel
--   checklist_item      — speeds up checklist completion queries
-- =============================================================================


-- ─── Card queries ─────────────────────────────────────────────────────────────

-- Primary board load: cards ordered within their list
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_list_id_order
  ON "Card" ("listId", "order");

-- Assignee + due date: used by workload view, overdue filters, "my cards"
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_assignee_due
  ON "Card" ("assigneeId", "dueDate")
  WHERE "dueDate" IS NOT NULL;

-- Sprint filter: quickly fetch all cards in a sprint
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_sprint_id
  ON "Card" ("sprintId")
  WHERE "sprintId" IS NOT NULL;

-- Priority filter: board filter bar by priority
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_org_priority
  ON "Card" ("listId", "priority");


-- ─── List queries ─────────────────────────────────────────────────────────────

-- Board load: lists ordered within a board
CREATE INDEX CONCURRENTLY IF NOT EXISTS lists_board_order
  ON "List" ("boardId", "order");


-- ─── Audit / Activity feed ────────────────────────────────────────────────────

-- Activity feed: paginated by org + timestamp (most recent first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_org_created
  ON "AuditLog" ("orgId", "createdAt" DESC);

-- Board-scoped activity (board settings page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_board_created
  ON "AuditLog" ("boardId", "createdAt" DESC)
  WHERE "boardId" IS NOT NULL;


-- ─── Notifications ────────────────────────────────────────────────────────────

-- Bell icon unread count + notification list
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_unread
  ON "Notification" ("userId", "orgId", "isRead", "createdAt" DESC);


-- ─── Time tracking ────────────────────────────────────────────────────────────

-- Time log panel: logs for a specific card
CREATE INDEX CONCURRENTLY IF NOT EXISTS time_logs_card_id
  ON "TimeLog" ("cardId", "loggedAt" DESC);

-- Per-user time reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS time_logs_user_org
  ON "TimeLog" ("userId", "orgId", "loggedAt" DESC);


-- ─── Checklists ───────────────────────────────────────────────────────────────

-- Checklist items ordered within a checklist (progress bar calc)
CREATE INDEX CONCURRENTLY IF NOT EXISTS checklist_items_checklist_order
  ON "ChecklistItem" ("checklistId", "order");


-- ─── Card dependencies ────────────────────────────────────────────────────────

-- Forward dependency lookup (what does this card block?)
CREATE INDEX CONCURRENTLY IF NOT EXISTS card_deps_blocker
  ON "CardDependency" ("blockerId");

-- Reverse dependency lookup (what is blocking this card?)
CREATE INDEX CONCURRENTLY IF NOT EXISTS card_deps_blocked
  ON "CardDependency" ("blockedId");


-- ─── Webhooks ─────────────────────────────────────────────────────────────────

-- Delivery history sorted by most recent
CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_deliveries_webhook_time
  ON "WebhookDelivery" ("webhookId", "attemptedAt" DESC);


-- ─── Board shares ─────────────────────────────────────────────────────────────

-- Fast token lookup for shared board routes
CREATE INDEX CONCURRENTLY IF NOT EXISTS board_shares_token
  ON "BoardShare" ("token")
  WHERE "isActive" = true;


-- ─── API keys ─────────────────────────────────────────────────────────────────

-- Fast hash lookup for API authentication middleware
CREATE INDEX CONCURRENTLY IF NOT EXISTS api_keys_hash
  ON "ApiKey" ("keyHash")
  WHERE "revokedAt" IS NULL;
