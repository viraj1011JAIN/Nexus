"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import crypto from "crypto";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { requireBoardPermission } from "@/lib/board-permissions";
import { db } from "@/lib/db";

// ─── Password helpers (scrypt, no external deps) ──────────────────────────────

const SCRYPT_KEY_LEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(plaintext: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plaintext, salt, SCRYPT_KEY_LEN, SCRYPT_PARAMS);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

function verifyPassword(plaintext: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const derived = crypto.scryptSync(plaintext, salt, SCRYPT_KEY_LEN, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

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

/**
 * Lightweight check: does the share identified by `token` require a password?
 *
 * Used by the client before calling getSharedBoardData so the UI can decide
 * whether to show the password gate without having to actually submit credentials.
 * Returns { requiresPassword: true } when the share is password-protected, and
 * { requiresPassword: false } otherwise.  Returns an error for expired/revoked tokens
 * without leaking whether the token exists (callers should treat errors as 404-equivalent).
 */
export async function checkShareRequiresPassword(token: string) {
  try {
    const share = await db.boardShare.findFirst({
      where: {
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { passwordHash: true },
    });
    if (!share) return { error: "Share not found.", code: "INVALID_TOKEN" as const };
    return { data: { requiresPassword: !!share.passwordHash } };
  } catch (e) {
    console.error("[CHECK_SHARE_PASSWORD]", e);
    return { error: "Failed to check share." };
  }
}

export async function getSharedBoardData(token: string, password?: string) {
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

    if (!share) return { error: "Share link not found or expired.", code: "INVALID_TOKEN" as const };

    // Password check before returning board data.
    // Using the same INVALID_TOKEN code for password failures prevents callers from
    // distinguishing whether the token was valid — avoids leaking token existence.
    if (share.passwordHash) {
      if (!password || !verifyPassword(password, share.passwordHash)) {
        // Return the same error *message* as the not-found path so callers
        // cannot distinguish a bad password from a non-existent token via the message.
        // Use INVALID_TOKEN (not a distinct INVALID_PASSWORD code) to prevent external
        // callers from enumerating whether a token exists by supplying a wrong password.
        // The UI already knows a password is required (via checkShareRequiresPassword),
        // so any error response here means "wrong password".
        return { error: "Share link not found or expired.", code: "INVALID_TOKEN" as const };
      }
    }

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
    return { error: "Failed to load shared board.", code: undefined };
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
    await requireRole("MEMBER", ctx);
    
    // RBAC: require BOARD_SHARE permission
    await requireBoardPermission(ctx, input.boardId, "BOARD_SHARE");
    
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
          ? hashPassword(validated.password)
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
    await requireRole("MEMBER", ctx);
    
    // RBAC: require BOARD_SHARE permission
    await requireBoardPermission(ctx, boardId, "BOARD_SHARE");
    
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
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const share = await db.boardShare.findFirst({
      where: { id: shareId, orgId: ctx.orgId },
    });
    if (!share) return { error: "Share not found." };

    // RBAC: require BOARD_SHARE permission on the board this share belongs to
    await requireBoardPermission(ctx, share.boardId, "BOARD_SHARE");

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
