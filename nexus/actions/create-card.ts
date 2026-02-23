"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateCard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Card } from "@prisma/client";
import { generateNextOrder } from "@/lib/lexorank";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

type InputType = z.infer<typeof CreateCard>;
type ReturnType = ActionState<InputType, Card>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { title, listId, boardId } = data;

  // 1. Build verified tenant context — orgId comes from Clerk, never from input
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  // Rate limit: 60 card creations per minute per user
  const rl = checkRateLimit(ctx.userId, "create-card", RATE_LIMITS["create-card"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }

  const dal = await createDAL(ctx);

  // 2. Demo mode protection: ctx.orgId is the canonical org value
  if (isDemoContext(ctx)) {
    return { error: "Cannot create cards in demo mode." };
  }

  try {
    // 3. Calculate order (append to end of list)
    const lastCard = await db.card.findFirst({
      where: { listId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const newOrder = generateNextOrder(lastCard?.order);

    // 4. Create card — DAL verifies boardId belongs to ctx.orgId before inserting
    const card = await dal.cards.create(listId, boardId, { title, order: newOrder });

    // 5. Audit log scoped to verified org
    await dal.auditLogs.create({
      entityId: card.id,
      entityType: "CARD",
      entityTitle: card.title,
      action: "CREATE",
    });

    revalidatePath(`/board/${boardId}`);

    // Fire automations + webhooks (TASK-019/020) — fire-and-forget, never throws
    try {
      void emitCardEvent(
        { type: "CARD_CREATED", orgId: ctx.orgId, boardId, cardId: card.id, context: { toListId: listId } },
        { cardId: card.id, cardTitle: card.title, listId, boardId, orgId: ctx.orgId }
      ).catch((err) => {
        logger.error("[create-card] emitCardEvent async rejection", {
          err,
          cardId: card.id,
          boardId,
          orgId: ctx.orgId,
        });
      });
    } catch (err) {
      // Synchronous throw from emitCardEvent (should not happen, but guard anyway)
      logger.error("[create-card] emitCardEvent threw synchronously", {
        err,
        cardId: card.id,
        boardId,
        orgId: ctx.orgId,
      });
    }

    return { data: card };
  } catch (error) {
    logger.error("Failed to create card", { error, listId, boardId });
    return { error: "Failed to create card. Please try again." };
  }
};

export const createCard = createSafeAction(CreateCard, handler);