"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateCard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Card } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

type InputType = z.infer<typeof UpdateCard>;
type ReturnType = ActionState<InputType, Card>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, ...values } = data;

  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const rl = checkRateLimit(ctx.userId, "update-card", RATE_LIMITS["update-card"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    return { error: "Cannot update cards in demo mode." };
  }

  // Capture card outside try so it is accessible after the catch block.
  let card: Card | undefined;

  try {
    // DAL verifies Card→List→Board→orgId === ctx.orgId before updating
    card = await dal.cards.update(id, values);

    await dal.auditLogs.create({
      entityId: card.id,
      entityType: "CARD",
      entityTitle: card.title,
      action: "UPDATE",
    });

    revalidatePath(`/board/${boardId}`);
  } catch (error) {
    console.error("[UPDATE_CARD_ERROR]", error);
    return { error: "Failed to update." };
  }

  // Deferred event emission is registered OUTSIDE the try/catch so that an
  // after() registration failure cannot shadow a successfully committed update.
  // emitCardEvent now returns Promise<void>; async callback lets after() track it.
  if (values.title) {
    after(async () => {
      await emitCardEvent(
        { type: "CARD_TITLE_CONTAINS", orgId: ctx.orgId, boardId, cardId: card!.id, context: { cardTitle: card!.title } },
        { cardId: card!.id, cardTitle: card!.title, boardId, orgId: ctx.orgId }
      );
    });
  }

  return { data: card };
};

export const updateCard = createSafeAction(UpdateCard, handler);