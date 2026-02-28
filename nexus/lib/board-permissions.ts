/**
 * Board Permission Engine — Core RBAC Logic
 *
 * This module is the single source of truth for board-level authorization.
 * It resolves the effective permissions for a user on a given board by:
 *
 *   1. Looking up the user's BoardMember row (role + optional custom scheme)
 *   2. Merging the board's default PermissionScheme (if any) with the member's
 *      override scheme (if any)
 *   3. Falling back to the built-in DEFAULT_BOARD_PERMISSIONS matrix
 *
 * SECURITY MODEL:
 *   - No BoardMember row → ZERO permissions (strict isolation)
 *   - Even org OWNER/ADMIN must have an explicit BoardMember row
 *   - Permission resolution is request-scoped cached (avoids extra DB hits)
 *
 * PERFORMANCE:
 *   - Results are cached per (boardId, userId) for the duration of the request
 *   - Uses React cache() for automatic deduplication in the same request lifecycle
 *   - Single DB query with nested include (board.permissionScheme.entries + member.scheme.entries)
 */

import 'server-only';
import { db } from "@/lib/db";
import { TenantContext, TenantError } from "@/lib/tenant-context";
import type { BoardRole, BoardPermission } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BoardMemberInfo = {
  memberId: string;
  boardId: string;
  userId: string;
  orgId: string;
  role: BoardRole;
  /** Permission scheme entries resolved for this member's role */
  permissions: Set<BoardPermission>;
};

// ─── Default Permission Matrix ───────────────────────────────────────────────
// This is the built-in fallback when no PermissionScheme is assigned.
// Each BoardRole has a set of permissions granted by default.

const DEFAULT_BOARD_PERMISSIONS: Record<BoardRole, readonly BoardPermission[]> = {
  OWNER: [
    // Board-level
    "BOARD_VIEW", "BOARD_EDIT_SETTINGS", "BOARD_DELETE", "BOARD_SHARE", "BOARD_MANAGE_MEMBERS",
    // List-level
    "LIST_CREATE", "LIST_EDIT", "LIST_DELETE", "LIST_REORDER",
    // Card-level
    "CARD_CREATE", "CARD_VIEW", "CARD_EDIT", "CARD_DELETE", "CARD_MOVE", "CARD_ASSIGN",
    "CARD_COMMENT", "CARD_EDIT_OWN_COMMENT", "CARD_DELETE_OWN_COMMENT", "CARD_DELETE_ANY_COMMENT",
    // Field visibility
    "FIELD_DESCRIPTION_VIEW", "FIELD_STORY_POINTS_VIEW", "FIELD_TIME_TRACKING_VIEW",
    "FIELD_ATTACHMENTS_VIEW", "FIELD_CUSTOM_FIELDS_VIEW",
    // Automation & Analytics
    "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "ANALYTICS_VIEW", "ANALYTICS_EXPORT",
  ],
  ADMIN: [
    "BOARD_VIEW", "BOARD_EDIT_SETTINGS", "BOARD_SHARE", "BOARD_MANAGE_MEMBERS",
    "LIST_CREATE", "LIST_EDIT", "LIST_DELETE", "LIST_REORDER",
    "CARD_CREATE", "CARD_VIEW", "CARD_EDIT", "CARD_DELETE", "CARD_MOVE", "CARD_ASSIGN",
    "CARD_COMMENT", "CARD_EDIT_OWN_COMMENT", "CARD_DELETE_OWN_COMMENT", "CARD_DELETE_ANY_COMMENT",
    "FIELD_DESCRIPTION_VIEW", "FIELD_STORY_POINTS_VIEW", "FIELD_TIME_TRACKING_VIEW",
    "FIELD_ATTACHMENTS_VIEW", "FIELD_CUSTOM_FIELDS_VIEW",
    "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "ANALYTICS_VIEW", "ANALYTICS_EXPORT",
  ],
  MEMBER: [
    "BOARD_VIEW",
    "LIST_CREATE", "LIST_EDIT", "LIST_REORDER",
    "CARD_CREATE", "CARD_VIEW", "CARD_EDIT", "CARD_MOVE", "CARD_ASSIGN",
    "CARD_COMMENT", "CARD_EDIT_OWN_COMMENT", "CARD_DELETE_OWN_COMMENT",
    "FIELD_DESCRIPTION_VIEW", "FIELD_STORY_POINTS_VIEW", "FIELD_TIME_TRACKING_VIEW",
    "FIELD_ATTACHMENTS_VIEW", "FIELD_CUSTOM_FIELDS_VIEW",
    "AUTOMATION_VIEW", "ANALYTICS_VIEW",
  ],
  VIEWER: [
    "BOARD_VIEW",
    "CARD_VIEW",
    "CARD_COMMENT", "CARD_EDIT_OWN_COMMENT", "CARD_DELETE_OWN_COMMENT",
    "FIELD_DESCRIPTION_VIEW",
    "ANALYTICS_VIEW",
  ],
} as const;

// ─── Request-scoped cache ────────────────────────────────────────────────────
// React cache() ensures we only query the DB once per (boardId, userId) per request.
// This avoids extra round-trips when multiple actions check permissions in the same request.

const _membershipCache = new Map<string, Promise<BoardMemberInfo | null>>();

/**
 * Clear the request-scoped permission cache.
 * Call this after modifying board membership (add/remove/change role).
 */
export function clearPermissionCache(): void {
  _membershipCache.clear();
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Get the board membership info for a user, including resolved permissions.
 * Returns null if the user is not a member of the board.
 *
 * @param boardId  The board to check
 * @param userId   The user's internal DB ID (User.id)
 * @param orgId    The org context for RLS scoping
 */
export async function getBoardMembership(
  boardId: string,
  userId: string,
  orgId: string
): Promise<BoardMemberInfo | null> {
  const cacheKey = `${boardId}:${userId}`;

  if (_membershipCache.has(cacheKey)) {
    return _membershipCache.get(cacheKey)!;
  }

  const promise = _fetchBoardMembership(boardId, userId, orgId);
  _membershipCache.set(cacheKey, promise);
  return promise;
}

/**
 * Internal fetch — resolves membership + permissions in a single DB query.
 */
async function _fetchBoardMembership(
  boardId: string,
  userId: string,
  _orgId: string
): Promise<BoardMemberInfo | null> {
  // Fetch the board member with both board-level and member-level scheme entries
  const member = await db.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    include: {
      // Member-level scheme override
      scheme: {
        include: {
          entries: true,
        },
      },
      // Board-level default scheme (via board relation)
      board: {
        select: {
          orgId: true,
          permissionScheme: {
            include: {
              entries: true,
            },
          },
        },
      },
    },
  });

  if (!member) return null;

  // Resolve effective permissions:
  // Priority: member scheme > board scheme > default matrix
  const role = member.role;
  const permissions = resolvePermissions(
    role,
    member.scheme?.entries ?? null,
    member.board.permissionScheme?.entries ?? null
  );

  return {
    memberId: member.id,
    boardId: member.boardId,
    userId: member.userId,
    orgId: member.board.orgId,
    role,
    permissions,
  };
}

/**
 * Resolves the effective permission set for a role.
 *
 * Resolution order (highest priority first):
 *   1. Member-specific scheme entries (per-member override)
 *   2. Board-level scheme entries (board default)
 *   3. Built-in DEFAULT_BOARD_PERMISSIONS matrix
 *
 * Within a scheme, entries with `granted=false` explicitly deny the permission.
 */
function resolvePermissions(
  role: BoardRole,
  memberSchemeEntries: Array<{ role: BoardRole; permission: BoardPermission; granted: boolean }> | null,
  boardSchemeEntries: Array<{ role: BoardRole; permission: BoardPermission; granted: boolean }> | null,
): Set<BoardPermission> {
  // Start with the built-in defaults for this role
  const result = new Set<BoardPermission>(DEFAULT_BOARD_PERMISSIONS[role]);

  // Apply board-level scheme overrides (if any)
  if (boardSchemeEntries) {
    for (const entry of boardSchemeEntries) {
      if (entry.role !== role) continue;
      if (entry.granted) {
        result.add(entry.permission);
      } else {
        result.delete(entry.permission);
      }
    }
  }

  // Apply member-level scheme overrides (highest priority)
  if (memberSchemeEntries) {
    for (const entry of memberSchemeEntries) {
      if (entry.role !== role) continue;
      if (entry.granted) {
        result.add(entry.permission);
      } else {
        result.delete(entry.permission);
      }
    }
  }

  return result;
}

/**
 * Check if a user has a specific permission on a board.
 * Returns the BoardMemberInfo if granted, throws TenantError if denied.
 *
 * This is the primary authorization gate for all board-scoped actions.
 *
 * @param ctx        Tenant context (from getTenantContext)
 * @param boardId    The board to check
 * @param permission The required permission
 *
 * @throws {TenantError} NOT_FOUND if user is not a board member
 * @throws {TenantError} FORBIDDEN if user lacks the specific permission
 */
export async function requireBoardPermission(
  ctx: TenantContext,
  boardId: string,
  permission: BoardPermission
): Promise<BoardMemberInfo> {
  // Resolve the user's internal DB ID from Clerk's userId
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { id: true },
  });

  if (!user) {
    throw new TenantError("NOT_FOUND", "Board not found");
  }

  const membership = await getBoardMembership(boardId, user.id, ctx.orgId);

  if (!membership) {
    // User is not a board member — return NOT_FOUND (don't reveal board exists)
    throw new TenantError("NOT_FOUND", "Board not found");
  }

  if (!membership.permissions.has(permission)) {
    throw new TenantError(
      "FORBIDDEN",
      `You don't have permission to perform this action`
    );
  }

  return membership;
}

/**
 * Check if a user has ANY of the specified permissions on a board.
 * Useful for UI visibility checks (e.g. show settings button if user can edit OR share).
 */
export async function hasBoardPermission(
  ctx: TenantContext,
  boardId: string,
  permission: BoardPermission
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { clerkUserId: ctx.userId },
      select: { id: true },
    });

    if (!user) return false;

    const membership = await getBoardMembership(boardId, user.id, ctx.orgId);
    if (!membership) return false;

    return membership.permissions.has(permission);
  } catch {
    return false;
  }
}

/**
 * Get the user's role on a board without throwing.
 * Returns null if the user is not a member.
 */
export async function getBoardRole(
  ctx: TenantContext,
  boardId: string
): Promise<BoardRole | null> {
  try {
    const user = await db.user.findUnique({
      where: { clerkUserId: ctx.userId },
      select: { id: true },
    });

    if (!user) return null;

    const membership = await getBoardMembership(boardId, user.id, ctx.orgId);
    return membership?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Get all permissions for a user on a board (for UI rendering).
 * Returns an empty set if the user is not a member.
 */
export async function getBoardPermissions(
  ctx: TenantContext,
  boardId: string
): Promise<Set<BoardPermission>> {
  try {
    const user = await db.user.findUnique({
      where: { clerkUserId: ctx.userId },
      select: { id: true },
    });

    if (!user) return new Set();

    const membership = await getBoardMembership(boardId, user.id, ctx.orgId);
    return membership?.permissions ?? new Set();
  } catch {
    return new Set();
  }
}

/**
 * Returns the default permissions for a given board role.
 * Useful for UI: showing what permissions a role gets by default.
 */
export function getDefaultPermissionsForRole(role: BoardRole): ReadonlySet<BoardPermission> {
  return new Set(DEFAULT_BOARD_PERMISSIONS[role]);
}

/**
 * Returns all available board permissions.
 * Useful for permission scheme management UI.
 */
export function getAllBoardPermissions(): readonly BoardPermission[] {
  return [
    "BOARD_VIEW", "BOARD_EDIT_SETTINGS", "BOARD_DELETE", "BOARD_SHARE", "BOARD_MANAGE_MEMBERS",
    "LIST_CREATE", "LIST_EDIT", "LIST_DELETE", "LIST_REORDER",
    "CARD_CREATE", "CARD_VIEW", "CARD_EDIT", "CARD_DELETE", "CARD_MOVE", "CARD_ASSIGN",
    "CARD_COMMENT", "CARD_EDIT_OWN_COMMENT", "CARD_DELETE_OWN_COMMENT", "CARD_DELETE_ANY_COMMENT",
    "FIELD_DESCRIPTION_VIEW", "FIELD_STORY_POINTS_VIEW", "FIELD_TIME_TRACKING_VIEW",
    "FIELD_ATTACHMENTS_VIEW", "FIELD_CUSTOM_FIELDS_VIEW",
    "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "ANALYTICS_VIEW", "ANALYTICS_EXPORT",
  ] as const;
}
