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

// Allowlisted keys from AutomationEvent.context that are safe to forward to webhooks.
// Prevents accidental leakage of internal-only context properties to external receivers.
const CONTEXT_WEBHOOK_ALLOWLIST = [
  "fromListId", "toListId", "labelId", "assigneeId", "priority", "dueDate", "cardTitle",
] as const;

/**
 * Emit a card event fire-and-forget: schedules automation + webhook delivery and
 * returns immediately. Never throws — any errors are caught and logged internally.
 */
export function emitCardEvent(
  event: AutomationEvent,
  webhookData?: Record<string, unknown>
): void {
  const webhookEvent = TRIGGER_TO_WEBHOOK[event.type];

  // Build webhook payload from an explicit allowlist of context keys to avoid
  // forwarding internal-only fields to external webhook receivers.
  const safeContext: Record<string, unknown> = {};
  if (event.context) {
    for (const key of CONTEXT_WEBHOOK_ALLOWLIST) {
      if (key in event.context) safeContext[key] = (event.context as Record<string, unknown>)[key];
    }
  }
  const payload: Record<string, unknown> = {
    ...safeContext,
    ...(webhookData ?? {}),
    cardId: event.cardId,
    boardId: event.boardId,
    // Use the outbound webhook event name (e.g. "card.created") as the type discriminator
    // so external consumers see a stable, documented event name rather than an internal
    // trigger identifier (e.g. "CARD_CREATED").
    type: webhookEvent ?? event.type,
  };

  // Fire-and-forget: do not block the calling server action on automation/webhook I/O.
  void Promise.allSettled([
    runAutomations(event),
    // Only fire webhooks when there is a mapped event name for this trigger type
    webhookEvent
      ? fireWebhooks(event.orgId, webhookEvent, payload)
      : Promise.resolve(),
  ]).then((results) => {
    // Log any rejections so they are observable (engine functions should not reject,
    // but this guards against unexpected throws).
    const [automationResult, webhookResult] = results;

    if (automationResult.status === "rejected") {
      // Sanitize: log only a short message snippet, never the full reason object
      // which may contain PII, user data, or stack traces with internal paths.
      const msgSnippet =
        automationResult.reason instanceof Error
          ? automationResult.reason.message.slice(0, 120)
          : String(automationResult.reason).slice(0, 120);
      console.error("[EventBus] runAutomations rejected unexpectedly", {
        msgSnippet,
        eventType: event.type,
        cardId: event.cardId,
        orgId: event.orgId,
      });
    }

    if (webhookResult.status === "rejected") {
      const msgSnippet =
        webhookResult.reason instanceof Error
          ? webhookResult.reason.message.slice(0, 120)
          : String(webhookResult.reason).slice(0, 120);
      // Compute payload size safely — JSON.stringify can throw on circular refs / BigInt
      let safePayloadSize: number;
      try { safePayloadSize = JSON.stringify(payload).length; } catch { safePayloadSize = -1; }
      console.error("[EventBus] fireWebhooks rejected unexpectedly", {
        msgSnippet,
        webhookEvent,
        cardId: event.cardId,
        orgId: event.orgId,
        // Omit full payload to avoid logging PII / free-form card content
        payloadSize: safePayloadSize,
      });
    }
  });
}
