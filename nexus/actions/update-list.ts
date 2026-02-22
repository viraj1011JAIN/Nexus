"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateList } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { List } from "@prisma/client";

type InputType = z.infer<typeof UpdateList>;
type ReturnType = ActionState<InputType, List>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, title } = data;

  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    return { error: "Cannot update lists in demo mode." };
  }

  try {
    // DAL verifies List→Board→orgId === ctx.orgId before updating
    const list = await dal.lists.update(id, boardId, { title });

    await dal.auditLogs.create({
      entityId: list.id,
      entityType: "LIST",
      entityTitle: list.title,
      action: "UPDATE",
    });

    revalidatePath(`/board/${boardId}`);
    return { data: list };
  } catch (error) {
    console.error("[UPDATE_LIST_ERROR]", error);
    return { error: "Failed to update list. Please try again." };
  }
};

export const updateList = createSafeAction(UpdateList, handler);