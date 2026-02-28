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
import type { MembershipRequest, BoardRole } from "@prisma/client";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RequestBoardAccessSchema = z.object({
  boardId: z.string().uuid(),
  requestedRole: z.enum(["MEMBER", "VIEWER"]).default("MEMBER"),
  message: z.string().max(500).optional(),
});

const ReviewMembershipRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
  /** Override the requested role (admin may grant a different role) */
  grantedRole: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).optional(),
});

const WithdrawRequestSchema = z.object({
  requestId: z.string().uuid(),
});

const GetPendingRequestsSchema = z.object({
  boardId: z.string().uuid().optional(), // If null, get all org requests
});

const GetMyRequestsSchema = z.object({});

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestInput = z.infer<typeof RequestBoardAccessSchema>;
type RequestReturn = ActionState<RequestInput, MembershipRequest>;

type ReviewInput = z.infer<typeof ReviewMembershipRequestSchema>;
type ReviewReturn = ActionState<ReviewInput, MembershipRequest>;

type WithdrawInput = z.infer<typeof WithdrawRequestSchema>;
type WithdrawReturn = ActionState<WithdrawInput, { success: true }>;

type GetPendingInput = z.infer<typeof GetPendingRequestsSchema>;
type GetPendingReturn = ActionState<GetPendingInput, MembershipRequest[]>;

type GetMyInput = z.infer<typeof GetMyRequestsSchema>;
type GetMyReturn = ActionState<GetMyInput, MembershipRequest[]>;

// ─── Request Board Access ─────────────────────────────────────────────────────

const requestBoardAccessHandler = async (data: RequestInput): Promise<RequestReturn> => {
  const ctx = await getTenantContext();
  // Must be an active org member to request board access (Gate 2 of dual-gate)
  await requireRole("MEMBER", ctx);

  // Check if user is already a board member
  const existingMember = await db.boardMember.findUnique({
    where: { boardId_userId: { boardId: data.boardId, userId: ctx.internalUserId } },
  });

  if (existingMember) {
    return { error: "You are already a member of this board." };
  }

  // Check if there's already a pending request
  const existingRequest = await db.membershipRequest.findFirst({
    where: {
      userId: ctx.internalUserId,
      boardId: data.boardId,
      type: "BOARD_ACCESS",
      status: "PENDING",
    },
  });

  if (existingRequest) {
    return { error: "You already have a pending request for this board." };
  }

  // Verify the board exists and belongs to this org
  const board = await db.board.findUnique({
    where: { id: data.boardId },
    select: { id: true, orgId: true, title: true },
  });

  if (!board || board.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Board not found");
  }

  try {
    // Default expiry: 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const request = await db.membershipRequest.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.internalUserId,
        type: "BOARD_ACCESS",
        boardId: data.boardId,
        requestedRole: data.requestedRole as BoardRole,
        message: data.message ?? null,
        expiresAt,
      },
    });

    await createAuditLog({
      entityId: request.id,
      entityType: "MEMBERSHIP_REQUEST",
      entityTitle: `Board access request: ${board.title}`,
      action: "CREATE",
      orgId: ctx.orgId,
      boardId: data.boardId,
    });

    return { data: request };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit access request.";
    return { error: message };
  }
};

export const requestBoardAccess = createSafeAction(RequestBoardAccessSchema, requestBoardAccessHandler);

// ─── Review Membership Request ────────────────────────────────────────────────

const reviewMembershipRequestHandler = async (data: ReviewInput): Promise<ReviewReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const request = await db.membershipRequest.findUnique({
    where: { id: data.requestId },
    include: { },
  });

  if (!request || request.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Request not found");
  }

  if (request.status !== "PENDING") {
    return { error: `This request has already been ${request.status.toLowerCase()}.` };
  }

  // Check if the request has expired
  if (request.expiresAt && request.expiresAt < new Date()) {
    await db.membershipRequest.update({
      where: { id: data.requestId },
      data: { status: "EXPIRED" },
    });
    return { error: "This request has expired." };
  }

  // For board access requests, require BOARD_MANAGE_MEMBERS permission
  if (request.type === "BOARD_ACCESS" && request.boardId) {
    await requireBoardPermission(ctx, request.boardId, "BOARD_MANAGE_MEMBERS");
  } else {
    // For org membership requests, require org ADMIN
    await requireRole("ADMIN", ctx);
  }

  try {
    const updated = await db.membershipRequest.update({
      where: { id: data.requestId },
      data: {
        status: data.action,
        reviewedBy: ctx.internalUserId,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote ?? null,
      },
    });

    // If approved, create the appropriate membership
    if (data.action === "APPROVED") {
      if (request.type === "BOARD_ACCESS" && request.boardId) {
        const grantedRole = (data.grantedRole ?? request.requestedRole) as BoardRole;

        // Check if already a member (edge case: added manually between request and review)
        const existing = await db.boardMember.findUnique({
          where: { boardId_userId: { boardId: request.boardId, userId: request.userId } },
        });

        if (!existing) {
          const board = await db.board.findUnique({
            where: { id: request.boardId },
            select: { orgId: true },
          });

          await db.boardMember.create({
            data: {
              boardId: request.boardId,
              userId: request.userId,
              orgId: board?.orgId ?? ctx.orgId,
              role: grantedRole,
              invitedBy: ctx.internalUserId,
              invitedAt: new Date(),
              joinedAt: new Date(),
            },
          });

          clearPermissionCache();
        }
      } else if (request.type === "ORG_MEMBERSHIP") {
        // Approve org membership: change status from PENDING to ACTIVE
        await db.organizationUser.updateMany({
          where: {
            userId: request.userId,
            organizationId: ctx.orgId,
            status: "PENDING",
          },
          data: { status: "ACTIVE" },
        });
      }
    }

    const targetUser = await db.user.findUnique({
      where: { id: request.userId },
      select: { name: true },
    });

    await createAuditLog({
      entityId: updated.id,
      entityType: "MEMBERSHIP_REQUEST",
      entityTitle: `${data.action}: ${targetUser?.name ?? "User"} ${request.type === "BOARD_ACCESS" ? "board access" : "org membership"}`,
      action: data.action === "APPROVED" ? "ACCESS_APPROVED" : "ACCESS_REJECTED",
      orgId: ctx.orgId,
      boardId: request.boardId ?? undefined,
    });

    revalidatePath("/");
    return { data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review request.";
    return { error: message };
  }
};

export const reviewMembershipRequest = createSafeAction(ReviewMembershipRequestSchema, reviewMembershipRequestHandler);

// ─── Withdraw Request ─────────────────────────────────────────────────────────

const withdrawRequestHandler = async (data: WithdrawInput): Promise<WithdrawReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const request = await db.membershipRequest.findUnique({
    where: { id: data.requestId },
  });

  if (!request || request.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Request not found");
  }

  // Only the requester can withdraw their own request
  if (request.userId !== ctx.internalUserId) {
    throw new TenantError("FORBIDDEN", "You can only withdraw your own requests");
  }

  if (request.status !== "PENDING") {
    return { error: `Cannot withdraw a request that is already ${request.status.toLowerCase()}.` };
  }

  await db.membershipRequest.update({
    where: { id: data.requestId },
    data: { status: "WITHDRAWN" },
  });

  return { data: { success: true } };
};

export const withdrawRequest = createSafeAction(WithdrawRequestSchema, withdrawRequestHandler);

// ─── Get Pending Requests ─────────────────────────────────────────────────────

const getPendingRequestsHandler = async (data: GetPendingInput): Promise<GetPendingReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Build the where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    orgId: ctx.orgId,
    status: "PENDING",
  };

  if (data.boardId) {
    // Board-scoped: require BOARD_MANAGE_MEMBERS permission
    await requireBoardPermission(ctx, data.boardId, "BOARD_MANAGE_MEMBERS");
    where.boardId = data.boardId;
    where.type = "BOARD_ACCESS";
  } else {
    // Org-wide: require ADMIN role
    await requireRole("ADMIN", ctx);
  }

  const requests = await db.membershipRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return { data: requests };
};

export const getPendingRequests = createSafeAction(GetPendingRequestsSchema, getPendingRequestsHandler);

// ─── Get My Requests ──────────────────────────────────────────────────────────

const getMyRequestsHandler = async (_data: GetMyInput): Promise<GetMyReturn> => {
  const ctx = await getTenantContext();
  // Any authenticated user can see their own requests
  // No requireRole needed — even PENDING users should see their request status

  const requests = await db.membershipRequest.findMany({
    where: {
      userId: ctx.internalUserId,
      orgId: ctx.orgId,
    },
    orderBy: { createdAt: "desc" },
  });

  return { data: requests };
};

export const getMyRequests = createSafeAction(GetMyRequestsSchema, getMyRequestsHandler);
