"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { requireBoardPermission, clearPermissionCache } from "@/lib/board-permissions";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction, ActionState } from "@/lib/create-safe-action";
import { TenantError } from "@/lib/tenant-context";
import type { BoardMember, BoardRole } from "@prisma/client";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const AddBoardMemberSchema = z.object({
  boardId: z.string().uuid(),
  userId: z.string().uuid(), // Internal user ID (User.id)
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

const UpdateBoardMemberRoleSchema = z.object({
  boardId: z.string().uuid(),
  memberId: z.string().uuid(), // BoardMember.id
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

const RemoveBoardMemberSchema = z.object({
  boardId: z.string().uuid(),
  memberId: z.string().uuid(), // BoardMember.id
});

const LeaveBoardSchema = z.object({
  boardId: z.string().uuid(),
});

const GetBoardMembersSchema = z.object({
  boardId: z.string().uuid(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type AddInput = z.infer<typeof AddBoardMemberSchema>;
type AddReturn = ActionState<AddInput, BoardMember>;

type UpdateInput = z.infer<typeof UpdateBoardMemberRoleSchema>;
type UpdateReturn = ActionState<UpdateInput, BoardMember>;

type RemoveInput = z.infer<typeof RemoveBoardMemberSchema>;
type RemoveReturn = ActionState<RemoveInput, { success: true }>;

type LeaveInput = z.infer<typeof LeaveBoardSchema>;
type LeaveReturn = ActionState<LeaveInput, { success: true }>;

type MemberWithUser = BoardMember & {
  user?: { id: string; name: string; email: string; imageUrl: string | null };
};
type GetInput = z.infer<typeof GetBoardMembersSchema>;
type GetReturn = ActionState<GetInput, MemberWithUser[]>;

// ─── Board Role Hierarchy (for role change validation) ────────────────────────

const BOARD_ROLE_HIERARCHY: Record<BoardRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

// ─── Add Board Member ─────────────────────────────────────────────────────────

const addBoardMemberHandler = async (data: AddInput): Promise<AddReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Require BOARD_MANAGE_MEMBERS permission on this board
  const callerMembership = await requireBoardPermission(ctx, data.boardId, "BOARD_MANAGE_MEMBERS");

  // Verify the target user is an ACTIVE org member
  const targetOrgMember = await db.organizationUser.findFirst({
    where: {
      userId: data.userId,
      organizationId: ctx.orgId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!targetOrgMember) {
    return { error: "User is not an active member of this organization." };
  }

  // Check if already a member
  const existing = await db.boardMember.findUnique({
    where: { boardId_userId: { boardId: data.boardId, userId: data.userId } },
  });

  if (existing) {
    return { error: "User is already a member of this board." };
  }

  // Cannot assign a role higher than your own
  const requestedRole = data.role as BoardRole;
  if (BOARD_ROLE_HIERARCHY[requestedRole] > BOARD_ROLE_HIERARCHY[callerMembership.role]) {
    return { error: "Cannot assign a role higher than your own." };
  }

  try {
    // Get the board's orgId for the denormalized field
    const board = await db.board.findUnique({
      where: { id: data.boardId },
      select: { orgId: true, title: true },
    });

    if (!board) {
      return { error: "Board not found." };
    }

    const member = await db.boardMember.create({
      data: {
        boardId: data.boardId,
        userId: data.userId,
        orgId: board.orgId,
        role: requestedRole,
        invitedBy: ctx.internalUserId,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });

    clearPermissionCache();

    // Get the user's name for the audit log
    const targetUser = await db.user.findUnique({
      where: { id: data.userId },
      select: { name: true },
    });

    await createAuditLog({
      entityId: member.id,
      entityType: "BOARD_MEMBER",
      entityTitle: `${targetUser?.name ?? "User"} (${requestedRole})`,
      action: "BOARD_MEMBER_ADDED",
      orgId: ctx.orgId,
      boardId: data.boardId,
    });

    revalidatePath(`/board/${data.boardId}`);
    return { data: member };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add board member.";
    return { error: message };
  }
};

export const addBoardMember = createSafeAction(AddBoardMemberSchema, addBoardMemberHandler);

// ─── Update Board Member Role ─────────────────────────────────────────────────

const updateBoardMemberRoleHandler = async (data: UpdateInput): Promise<UpdateReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Require BOARD_MANAGE_MEMBERS
  const callerMembership = await requireBoardPermission(ctx, data.boardId, "BOARD_MANAGE_MEMBERS");

  // Fetch the target member
  const target = await db.boardMember.findUnique({
    where: { id: data.memberId },
    select: { id: true, boardId: true, userId: true, role: true },
  });

  if (!target || target.boardId !== data.boardId) {
    throw new TenantError("NOT_FOUND", "Board member not found");
  }

  // Cannot modify someone with equal or higher role (unless you are OWNER)
  if (
    callerMembership.role !== "OWNER" &&
    BOARD_ROLE_HIERARCHY[target.role] >= BOARD_ROLE_HIERARCHY[callerMembership.role]
  ) {
    return { error: "Cannot modify a member with equal or higher role." };
  }

  // Cannot assign a role higher than your own
  const newRole = data.role as BoardRole;
  if (BOARD_ROLE_HIERARCHY[newRole] > BOARD_ROLE_HIERARCHY[callerMembership.role]) {
    return { error: "Cannot assign a role higher than your own." };
  }

  // Cannot demote the last OWNER
  if (target.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await db.boardMember.count({
      where: { boardId: data.boardId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "Cannot demote the last board owner. Transfer ownership first." };
    }
  }

  const previousRole = target.role;
  const updated = await db.boardMember.update({
    where: { id: data.memberId },
    data: { role: newRole },
  });

  clearPermissionCache();

  const targetUser = await db.user.findUnique({
    where: { id: target.userId },
    select: { name: true },
  });

  await createAuditLog({
    entityId: updated.id,
    entityType: "BOARD_MEMBER",
    entityTitle: `${targetUser?.name ?? "User"} role: ${previousRole} → ${newRole}`,
    action: "UPDATE",
    orgId: ctx.orgId,
    boardId: data.boardId,
    previousValues: { role: previousRole },
    newValues: { role: newRole },
  });

  revalidatePath(`/board/${data.boardId}`);
  return { data: updated };
};

export const updateBoardMemberRole = createSafeAction(UpdateBoardMemberRoleSchema, updateBoardMemberRoleHandler);

// ─── Remove Board Member ──────────────────────────────────────────────────────

const removeBoardMemberHandler = async (data: RemoveInput): Promise<RemoveReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Require BOARD_MANAGE_MEMBERS
  const callerMembership = await requireBoardPermission(ctx, data.boardId, "BOARD_MANAGE_MEMBERS");

  const target = await db.boardMember.findUnique({
    where: { id: data.memberId },
    select: { id: true, boardId: true, userId: true, role: true },
  });

  if (!target || target.boardId !== data.boardId) {
    throw new TenantError("NOT_FOUND", "Board member not found");
  }

  // Cannot remove yourself via this action (use leaveBoard instead)
  if (target.userId === ctx.internalUserId) {
    return { error: "Use 'Leave Board' to remove yourself." };
  }

  // Cannot remove someone with equal or higher role (unless you are OWNER)
  if (
    callerMembership.role !== "OWNER" &&
    BOARD_ROLE_HIERARCHY[target.role] >= BOARD_ROLE_HIERARCHY[callerMembership.role]
  ) {
    return { error: "Cannot remove a member with equal or higher role." };
  }

  // Cannot remove the last OWNER
  if (target.role === "OWNER") {
    const ownerCount = await db.boardMember.count({
      where: { boardId: data.boardId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "Cannot remove the last board owner." };
    }
  }

  const targetUser = await db.user.findUnique({
    where: { id: target.userId },
    select: { name: true },
  });

  await db.boardMember.delete({ where: { id: data.memberId } });
  clearPermissionCache();

  await createAuditLog({
    entityId: target.id,
    entityType: "BOARD_MEMBER",
    entityTitle: `${targetUser?.name ?? "User"} removed`,
    action: "BOARD_MEMBER_REMOVED",
    orgId: ctx.orgId,
    boardId: data.boardId,
  });

  revalidatePath(`/board/${data.boardId}`);
  return { data: { success: true } };
};

export const removeBoardMember = createSafeAction(RemoveBoardMemberSchema, removeBoardMemberHandler);

// ─── Leave Board ──────────────────────────────────────────────────────────────

const leaveBoardHandler = async (data: LeaveInput): Promise<LeaveReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const myMembership = await db.boardMember.findUnique({
    where: { boardId_userId: { boardId: data.boardId, userId: ctx.internalUserId } },
    select: { id: true, role: true },
  });

  if (!myMembership) {
    throw new TenantError("NOT_FOUND", "Board not found");
  }

  // Cannot leave if you are the last OWNER
  if (myMembership.role === "OWNER") {
    const ownerCount = await db.boardMember.count({
      where: { boardId: data.boardId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return { error: "You are the last owner. Transfer ownership before leaving." };
    }
  }

  await db.boardMember.delete({ where: { id: myMembership.id } });
  clearPermissionCache();

  await createAuditLog({
    entityId: myMembership.id,
    entityType: "BOARD_MEMBER",
    entityTitle: "Left board",
    action: "BOARD_MEMBER_REMOVED",
    orgId: ctx.orgId,
    boardId: data.boardId,
  });

  revalidatePath("/");
  return { data: { success: true } };
};

export const leaveBoard = createSafeAction(LeaveBoardSchema, leaveBoardHandler);

// ─── Get Board Members ────────────────────────────────────────────────────────

const getBoardMembersHandler = async (data: GetInput): Promise<GetReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Must be a board member to see other members
  await requireBoardPermission(ctx, data.boardId, "BOARD_VIEW");

  const members = await db.boardMember.findMany({
    where: { boardId: data.boardId },
    include: {
      board: { select: { orgId: true } },
    },
    orderBy: [
      { role: "asc" },
      { joinedAt: "asc" },
    ],
  });

  // Verify org scoping (defense-in-depth)
  const filtered = members.filter(m => m.board.orgId === ctx.orgId);

  // Batch-fetch user details
  const userIds = filtered.map(m => m.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, imageUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const result: MemberWithUser[] = filtered.map(m => ({
    ...m,
    user: userMap.get(m.userId) ?? undefined,
  }));

  return { data: result };
};

export const getBoardMembers = createSafeAction(GetBoardMembersSchema, getBoardMembersHandler);
