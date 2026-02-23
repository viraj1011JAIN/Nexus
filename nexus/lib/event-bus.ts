/**
 * Event Bus  — wires automation-engine + webhook-delivery together.
 *
 * Server actions call `emitCardEvent()` once and this helper fans out
 * to both the automation engine and the webhook delivery queue.
 * Everything is fire-and-forget; this function never throws.
 */

import { runAutomations, type AutomationEvent } from "@/lib/automation-engine";
import { fireWebhooks } from "@/lib/webhook-delivery";

// Map internal trigger types → outbound webhook event names.
// Typed as Partial so only known mappings are allowed and missing ones are handled explicitly.
const TRIGGER_TO_WEBHOOK: Partial<Record<AutomationEvent["type"], string>> = {
  CARD_CREATED:         "card.created",
  CARD_MOVED:           "card.moved",
  CARD_DELETED:         "card.deleted",
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
  const webhookEvent = TRIGGER_TO_WEBHOOK[event.type];
  // Always merge: context fields first, then caller-supplied data, then explicit
  // identifiers — so cardId/boardId/type can never be accidentally omitted.
  const payload: Record<string, unknown> = {
    ...event.context,
    ...(webhookData ?? {}),
    cardId: event.cardId,
    boardId: event.boardId,
    type: event.type,
  };

  // Automations and webhooks are fully independent — run in parallel
  const results = await Promise.allSettled([
    runAutomations(event),
    // Only fire webhooks when there is a mapped event name for this trigger type
    webhookEvent
      ? fireWebhooks(event.orgId, webhookEvent, payload)
      : Promise.resolve(),
  ]);

  // Log any rejections so they are observable (engine functions should not reject,
  // but this guards against unexpected throws)
  const [automationResult, webhookResult] = results;
  if (automationResult.status === "rejected") {
    console.error(
      "[EventBus] runAutomations rejected unexpectedly",
      {
        reason: automationResult.reason,
        eventType: event.type,
        cardId: event.cardId,
        orgId: event.orgId,
      }
    );
  }
  if (webhookResult.status === "rejected") {
    // Compute payload size safely — JSON.stringify can throw on circular refs / BigInt
    let safePayloadSize: number;
    try { safePayloadSize = JSON.stringify(payload).length; } catch { safePayloadSize = -1; }
    console.error(
      "[EventBus] fireWebhooks rejected unexpectedly",
      {
        reason: webhookResult.reason,
        webhookEvent,
        cardId: event.cardId,
        orgId: event.orgId,
        // Omit full payload to avoid logging PII / free-form content
        payloadSize: safePayloadSize,
      }
    );
  }
}
