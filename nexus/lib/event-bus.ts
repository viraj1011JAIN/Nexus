/**
 * Event Bus  — wires automation-engine + webhook-delivery together.
 *
 * Server actions call `emitCardEvent()` once and this helper fans out
 * to both the automation engine and the webhook delivery queue.
 * Everything is fire-and-forget; this function never throws.
 */

import { runAutomations, type AutomationEvent } from "@/lib/automation-engine";
import { fireWebhooks } from "@/lib/webhook-delivery";

// Map our internal trigger types → outbound webhook event names
const TRIGGER_TO_WEBHOOK: Record<string, string> = {
  CARD_CREATED:         "card.created",
  CARD_MOVED:           "card.moved",
  PRIORITY_CHANGED:     "card.updated",
  LABEL_ADDED:          "card.updated",
  MEMBER_ASSIGNED:      "card.updated",
  CHECKLIST_COMPLETED:  "card.updated",
  CARD_OVERDUE:         "card.updated",
  CARD_DUE_SOON:        "card.updated",
  CARD_TITLE_CONTAINS:  "card.updated",
};

export async function emitCardEvent(
  event: AutomationEvent,
  webhookData?: Record<string, unknown>
): Promise<void> {
  // Automations and webhooks are fully independent — run in parallel
  await Promise.allSettled([
    runAutomations(event),
    fireWebhooks(
      event.orgId,
      TRIGGER_TO_WEBHOOK[event.type] ?? "card.updated",
      webhookData ?? {
        cardId: event.cardId,
        boardId: event.boardId,
        type: event.type,
        ...event.context,
      }
    ),
  ]);
}
