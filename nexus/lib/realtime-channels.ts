/**
 * Realtime Channel Names — Tenant-Isolated
 *
 * RULE: Every channel name MUST include the orgId as a namespace prefix.
 *
 * WHY: Supabase Realtime channel subscriptions are client-controlled by default.
 * Without an orgId prefix, a user from Org A could subscribe to `board:xyz` and
 * receive events for a board that belongs to Org B (if they happen to know xyz).
 *
 * PATTERN: `org:{orgId}:{type}:{entityId}`
 *
 * The Supabase JWT (set via Authorization header) provides a second layer of
 * enforcement when RLS policies are active on Realtime publications. These
 * channel names provide defence-in-depth at the application layer.
 */

// ── Board-level channels ───────────────────────────────────────────────────

/** Throws if orgId contains the channel delimiter character ':'. */
function validateOrgId(orgId: string): void {
  if (orgId.includes(":")) {
    throw new Error(
      `Invalid orgId "${orgId}": orgId must not contain the ':' delimiter character. Channel names use ':' as a separator and embedding it in an orgId would corrupt the channel namespace.`
    );
  }
}

/**
 * Throws if an entity ID (boardId, listId, etc.) is empty or contains the
 * channel delimiter character ':'. Mirrors the validateOrgId guard so all
 * channel-name segments are uniformly sanitised.
 */
function validateEntityId(entityId: string, label = "entityId"): void {
  if (!entityId) {
    throw new Error(
      `Invalid ${label} "${entityId}": ${label} must not be empty.`
    );
  }
  if (entityId.includes(":")) {
    throw new Error(
      `Invalid ${label} "${entityId}": ${label} must not contain the ':' delimiter character. Channel names use ':' as a separator and embedding it in a ${label} would corrupt the channel namespace.`
    );
  }
}

/**
 * postgres_changes channel for a specific board.
 * Carries card, list, and board mutations in real time.
 */
export function boardChannel(orgId: string, boardId: string): string {
  validateOrgId(orgId);
  validateEntityId(boardId, "boardId");
  return `org:${orgId}:board:${boardId}`;
}

/**
 * Presence channel for collaborative board cursors and online indicators.
 * Presence state includes: userId, name, avatar, cursor position, active card.
 */
export function boardPresenceChannel(orgId: string, boardId: string): string {
  validateOrgId(orgId);
  validateEntityId(boardId, "boardId");
  return `org:${orgId}:presence:${boardId}`;
}

/**
 * Analytics channel for live board metrics (card counts, velocity, etc.).
 */
export function boardAnalyticsChannel(orgId: string, boardId: string): string {
  validateOrgId(orgId);
  validateEntityId(boardId, "boardId");
  return `org:${orgId}:analytics:${boardId}`;
}

// ── Organisation-level channels ────────────────────────────────────────────

/**
 * Organisation-wide channel.
 * Used for board list updates (new/deleted boards visible in dashboard).
 */
export function orgBoardsChannel(orgId: string): string {
  validateOrgId(orgId);
  return `org:${orgId}:boards`;
}

/**
 * Organisation-wide activity feed channel.
 * Audit log events streamed to the activity sidebar.
 */
export function orgActivityChannel(orgId: string): string {
  validateOrgId(orgId);
  return `org:${orgId}:activity`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract orgId from a channel name for audit/logging purposes.
 * Returns null if the channel name doesn't follow the expected pattern.
 */
export function extractOrgIdFromChannel(channelName: string): string | null {
  const match = channelName.match(/^org:([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Assert that a channel name belongs to the given org.
 * Throws if the channel would allow cross-tenant subscription.
 */
export function assertChannelBelongsToOrg(channelName: string, orgId: string): void {
  const channelOrgId = extractOrgIdFromChannel(channelName);
  if (channelOrgId !== orgId) {
    throw new Error(`Channel isolation violation: channel "${channelName}" does not belong to org "${orgId}"`);
  }
}
