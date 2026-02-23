"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateShareSchema = z.object({
  boardId: z.string().uuid(),
  allowComments: z.boolean().default(false),
  allowCopyCards: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  password: z.string().min(4).max(50).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getBoardShareLink(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const board = await db.board.findFirst({
      where: { id: boardId, orgId: ctx.orgId },
      select: { id: true, title: true },
    });
    if (!board) return { error: "Board not found." };

    const share = await db.boardShare.findFirst({
      where: { boardId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return { data: share };
  } catch (e) {
    console.error("[GET_BOARD_SHARE]", e);
    return { error: "Failed to get share link." };
  }
}

export async function getSharedBoardData(token: string) {
  try {
    const share = await db.boardShare.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        board: {
          include: {
            lists: {
              orderBy: { order: "asc" },
              include: {
                cards: {
                  orderBy: { order: "asc" },
                  include: {
                    assignee: {
                      select: { name: true, imageUrl: true },
                    },
                    labels: {
                      include: { label: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!share) return { error: "Share link not found or expired." };

    // Increment view counter
    await db.boardShare.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      data: {
        board: share.board,
        share: {
          id: share.id,
          allowComments: share.allowComments,
          allowCopyCards: share.allowCopyCards,
          viewCount: share.viewCount + 1,
        },
      },
    };
  } catch (e) {
    console.error("[GET_SHARED_BOARD]", e);
    return { error: "Failed to load shared board." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createBoardShareLink(input: {
  boardId: string;
  allowComments?: boolean;
  allowCopyCards?: boolean;
  expiresAt?: string;
  password?: string;
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateShareSchema.parse(input);

    const board = await db.board.findFirst({
      where: { id: validated.boardId, orgId: ctx.orgId },
    });
    if (!board) return { error: "Board not found." };

    // Deactivate old shares
    await db.boardShare.updateMany({
      where: { boardId: validated.boardId, isActive: true },
      data: { isActive: false },
    });

    // Generate secure token
    const token = crypto.randomBytes(24).toString("base64url");

    const share = await db.boardShare.create({
      data: {
        boardId: validated.boardId,
        token,
        isActive: true,
        allowComments: validated.allowComments,
        allowCopyCards: validated.allowCopyCards,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        passwordHash: validated.password
          ? crypto.createHash("sha256").update(validated.password).digest("hex")
          : null,
        createdBy: ctx.userId,
        orgId: ctx.orgId,
      },
    });

    return { data: share };
  } catch (e) {
    console.error("[CREATE_BOARD_SHARE]", e);
    return { error: "Failed to create share link." };
  }
}

export async function revokeBoardShareLink(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    await db.boardShare.updateMany({
      where: { boardId, orgId: ctx.orgId, isActive: true },
      data: { isActive: false },
    });

    revalidatePath(`/board/${boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[REVOKE_BOARD_SHARE]", e);
    return { error: "Failed to revoke share link." };
  }
}

export async function updateBoardShareSettings(
  shareId: string,
  settings: {
    allowComments?: boolean;
    allowCopyCards?: boolean;
    expiresAt?: string | null;
  }
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const share = await db.boardShare.findFirst({
      where: { id: shareId, orgId: ctx.orgId },
    });
    if (!share) return { error: "Share not found." };

    const updated = await db.boardShare.update({
      where: { id: shareId },
      data: {
        ...(settings.allowComments !== undefined ? { allowComments: settings.allowComments } : {}),
        ...(settings.allowCopyCards !== undefined ? { allowCopyCards: settings.allowCopyCards } : {}),
        ...(settings.expiresAt !== undefined
          ? { expiresAt: settings.expiresAt ? new Date(settings.expiresAt) : null }
          : {}),
      },
    });

    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_BOARD_SHARE_SETTINGS]", e);
    return { error: "Failed to update share settings." };
  }
}
