"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateList } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { List } from "@prisma/client";
import { generateNextOrder } from "@/lib/lexorank";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

type InputType = z.infer<typeof CreateList>;
type ReturnType = ActionState<InputType, List>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { title, boardId } = data;

  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Rate limit: 20 list creations per minute per user
  const rl = checkRateLimit(ctx.userId, "create-list", RATE_LIMITS["create-list"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    return { error: "Cannot create lists in demo mode." };
  }

  try {
    const lastList = await db.list.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const newOrder = generateNextOrder(lastList?.order);

    // DAL verifies boardId belongs to ctx.orgId before inserting
    const list = await dal.lists.create(boardId, { title, order: newOrder });

    await dal.auditLogs.create({
      entityId: list.id,
      entityType: "LIST",
      entityTitle: list.title,
      action: "CREATE",
    });

    revalidatePath(`/board/${boardId}`);
    return { data: list };
  } catch (error) {
    console.error("[CREATE_LIST_ERROR]", error);
    return { error: "Failed to create list. Please try again." };
  }
};

export const createList = createSafeAction(CreateList, handler);