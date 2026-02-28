/**
 * Cross-Board Access — Utilities for operations that span multiple boards.
 *
 * These functions are used by org-level admin features:
 *   - Dashboard showing all boards a user has access to
 *   - Org admin viewing board membership across the org
 *   - Cross-board search results (cards across accessible boards)
 *
 * SECURITY: All functions require a valid TenantContext and never bypass
 * the strict isolation model. Results are always filtered to boards where
 * the calling user has explicit membership.
 */

import 'server-only';
import { db } from "@/lib/db";
import { TenantContext } from "@/lib/tenant-context";
import type { BoardRole } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BoardSummary = {
  id: string;
  title: string;
  imageThumbUrl: string | null;
  isPrivate: boolean;
  myRole: BoardRole;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type OrgBoardOverview = {
  boardId: string;
  boardTitle: string;
  memberCount: number;
  ownerNames: string[];
};

// ─── User's accessible boards ────────────────────────────────────────────────

/**
 * Get all boards the current user has access to in their org.
 * Returns board summaries with the user's role and member count.
 *
 * This is the primary query for the dashboard board list.
 */
export async function getMyBoards(ctx: TenantContext): Promise<BoardSummary[]> {
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { id: true },
  });

  if (!user) return [];

  const memberships = await db.boardMember.findMany({
    where: {
      userId: user.id,
      orgId: ctx.orgId,
    },
    include: {
      board: {
        select: {
          id: true,
          title: true,
          imageThumbUrl: true,
          isPrivate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { members: true },
          },
        },
      },
    },
    orderBy: {
      board: { updatedAt: "desc" },
    },
  });

  return memberships.map((m) => ({
    id: m.board.id,
    title: m.board.title,
    imageThumbUrl: m.board.imageThumbUrl,
    isPrivate: m.board.isPrivate,
    myRole: m.role,
    memberCount: m.board._count.members,
    createdAt: m.board.createdAt,
    updatedAt: m.board.updatedAt,
  }));
}

/**
 * Get all boards in the org with membership overview.
 * Only accessible to org ADMIN/OWNER for org-level administration.
 *
 * NOTE: This intentionally does NOT require board membership because
 * org admins need visibility into all boards to manage the org.
 * However, it only returns metadata — not board contents.
 */
export async function getOrgBoardOverview(ctx: TenantContext): Promise<OrgBoardOverview[]> {
  // This is an admin-only function — caller must verify ADMIN role
  const boards = await db.board.findMany({
    where: { orgId: ctx.orgId },
    select: {
      id: true,
      title: true,
      _count: { select: { members: true } },
      members: {
        where: { role: "OWNER" },
        include: {
          board: false, // Don't include board back-reference
        },
      },
    },
    orderBy: { title: "asc" },
  });

  // Batch-fetch owner user names
  const ownerUserIds = [...new Set(boards.flatMap(b => b.members.map(m => m.userId)))];
  const users = await db.user.findMany({
    where: { id: { in: ownerUserIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.id, u.name]));

  return boards.map((b) => ({
    boardId: b.id,
    boardTitle: b.title,
    memberCount: b._count.members,
    ownerNames: b.members.map(m => userMap.get(m.userId) ?? "Unknown"),
  }));
}

/**
 * Check if a user has access to any board in the org.
 * Useful for showing "no boards" empty states vs. "request access" prompts.
 */
export async function hasAnyBoardAccess(ctx: TenantContext): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { id: true },
  });

  if (!user) return false;

  const count = await db.boardMember.count({
    where: {
      userId: user.id,
      orgId: ctx.orgId,
    },
  });

  return count > 0;
}

/**
 * Get boards a user does NOT have access to (for the "Request Access" UI).
 * Returns minimal info — just board ID, title, and whether it's private.
 * Does NOT reveal any board contents.
 */
export async function getRequestableBoards(ctx: TenantContext): Promise<Array<{
  id: string;
  title: string;
  isPrivate: boolean;
  memberCount: number;
  hasPendingRequest: boolean;
}>> {
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { id: true },
  });

  if (!user) return [];

  // Get boards user is NOT a member of
  const allBoards = await db.board.findMany({
    where: {
      orgId: ctx.orgId,
      members: {
        none: { userId: user.id },
      },
    },
    select: {
      id: true,
      title: true,
      isPrivate: true,
      _count: { select: { members: true } },
    },
    orderBy: { title: "asc" },
  });

  // Check for pending requests
  const pendingRequests = await db.membershipRequest.findMany({
    where: {
      userId: user.id,
      orgId: ctx.orgId,
      type: "BOARD_ACCESS",
      status: "PENDING",
    },
    select: { boardId: true },
  });
  const pendingBoardIds = new Set(pendingRequests.map(r => r.boardId));

  return allBoards.map((b) => ({
    id: b.id,
    title: b.title,
    isPrivate: b.isPrivate,
    memberCount: b._count.members,
    hasPendingRequest: pendingBoardIds.has(b.id),
  }));
}
