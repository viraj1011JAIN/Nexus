"use server";

/**
 * update-board — rename a board and/or swap its background image.
 *
 * Requires ADMIN role: board name changes and background updates are
 * considered board-level administration.
 */

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { z } from "zod";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

// ─── Schema ────────────────────────────────────────────────────────────────────

const UpdateBoardSchema = z.object({
  boardId: z.string().min(1),
  // All other fields optional — supply only what needs changing
  title:         z.string().min(1, "Title required").max(100, "Title too long").optional(),
  imageId:       z.string().nullable().optional(),
  imageThumbUrl: z.string().nullable().optional(),
  imageFullUrl:  z.string().nullable().optional(),
  imageUserName: z.string().nullable().optional(),
  imageLinkHTML: z.string().nullable().optional(),
});

export type UpdateBoardInput = z.infer<typeof UpdateBoardSchema>;

// ─── Action ────────────────────────────────────────────────────────────────────

export async function updateBoard(
  input: UpdateBoardInput,
): Promise<{ data?: { id: string; title: string }; error?: string }> {
  // 1. Validate input
  const parsed = UpdateBoardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { boardId, ...updates } = parsed.data;

  // 2. Auth + role check
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx);

  // 3. Rate limit (reuse "update-card" bucket — 120 req/min, generous for settings)
  const rl = checkRateLimit(ctx.userId, "update-card", RATE_LIMITS["update-card"]);
  if (!rl.allowed) {
    return {
      error: `Rate limit reached. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`,
    };
  }

  const dal = await createDAL(ctx);

  try {
    // 4. Build only the keys the caller explicitly provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (updates.title         !== undefined) data.title         = updates.title;
    if (updates.imageId       !== undefined) data.imageId       = updates.imageId;
    if (updates.imageThumbUrl !== undefined) data.imageThumbUrl = updates.imageThumbUrl;
    if (updates.imageFullUrl  !== undefined) data.imageFullUrl  = updates.imageFullUrl;
    if (updates.imageUserName !== undefined) data.imageUserName = updates.imageUserName;
    if (updates.imageLinkHTML !== undefined) data.imageLinkHTML = updates.imageLinkHTML;

    if (Object.keys(data).length === 0) {
      return { error: "Nothing to update." };
    }

    // 5. Persist via DAL (verifies board.orgId === ctx.orgId)
    const board = await dal.boards.update(boardId, data);

    // 6. Audit log
    await dal.auditLogs.create({
      entityId:    board.id,
      entityType:  "BOARD",
      entityTitle: board.title,
      action:      "UPDATE",
    });

    // 7. Bust caches
    revalidatePath(`/board/${boardId}`);
    revalidatePath("/");

    return { data: { id: board.id, title: board.title } };
  } catch {
    return { error: "Failed to update board. Please try again." };
  }
}
