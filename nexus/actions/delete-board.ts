"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { DeleteBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

type InputType = z.infer<typeof DeleteBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  // Deleting boards requires OWNER role
  const ctx = await getTenantContext();
  await requireRole("OWNER", ctx);

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

export const deleteBoard = createSafeAction(DeleteBoard, handler);
