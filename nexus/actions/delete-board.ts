"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { requireBoardPermission } from "@/lib/board-permissions";
import { createStepUpAction } from "@/lib/step-up-action";
import { DeleteBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

/**
 * deleteBoard — Step-Up Protected Destructive Action
 *
 * Requires the user to have verified their credentials within the last
 * 10 minutes ('strict' reverification level) before a board can be
 * permanently deleted.  The client must wrap this action with
 * `useReverification(deleteBoard)` from '@clerk/nextjs' — Clerk's built-in
 * modal will prompt for biometric / TOTP / OTP when the window has expired.
 *
 * This prevents "laptop left open" attacks where a physically-proximate
 * person could delete an entire workspace using an already-signed-in session.
 */

type InputType = z.infer<typeof DeleteBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // RBAC: require BOARD_DELETE permission (default: only OWNER has this)
  await requireBoardPermission(ctx, data.id, "BOARD_DELETE");

  const rl = checkRateLimit(ctx.userId, "delete-board", RATE_LIMITS["delete-board"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }

  const dal = await createDAL(ctx);

  try {
    // DAL verifies board.orgId === ctx.orgId before deleting
    const deletedBoard = await dal.boards.delete(data.id);

    await dal.auditLogs.create({
      entityId: deletedBoard.id,
      entityType: "BOARD",
      entityTitle: deletedBoard.title,
      action: "DELETE",
    });

    revalidatePath(`/`);
    return { data: deletedBoard };
  } catch {
    return { error: "Failed to delete board. Please try again." };
  }
};

// 'strict' = 10-minute re-verification window; biometric / TOTP / OTP challenge
export const deleteBoard = createStepUpAction(DeleteBoard, handler, "strict");
