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

  try {
    // DAL verifies Card→List→Board→orgId === ctx.orgId before updating
    const card = await dal.cards.update(id, values);

    await dal.auditLogs.create({
      entityId: card.id,
      entityType: "CARD",
      entityTitle: card.title,
      action: "UPDATE",
    });

    revalidatePath(`/board/${boardId}`);

    // Fire CARD_TITLE_CONTAINS event if the title was updated (TASK-019) — fire-and-forget.
    // Deferred via Promise.resolve().then() so a synchronous throw from emitCardEvent
    // cannot be caught by the outer try/catch and turned into a false failure response.
    // Use card.title (post-write canonical value) rather than values.title (input) in
    // the event context so automation rules see the authoritative stored title.
    if (values.title) {
      // emitCardEvent is fully fire-and-forget (returns void, handles errors internally).
      // Defer via after() so the event fires post-response without blocking the action.
      after(() => {
        emitCardEvent(
          { type: "CARD_TITLE_CONTAINS", orgId: ctx.orgId, boardId, cardId: card.id, context: { cardTitle: card.title } },
          { cardId: card.id, cardTitle: card.title, boardId, orgId: ctx.orgId }
        );
      });
    }

    return { data: card };
  } catch (error) {
    console.error("[UPDATE_CARD_ERROR]", error);
    return { error: "Failed to update." };
  }
};

export const updateCard = createSafeAction(UpdateCard, handler);