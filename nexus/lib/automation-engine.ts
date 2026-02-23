/**
 * Automation Engine  (TASK-019)
 *
 * Evaluates and executes board automation rules whenever a card event fires.
 * Called fire-and-forget from server actions — failures must NEVER propagate
 * back to the caller.
 *
 * Architecture:
 *   1. Receive an AutomationEvent (what happened, to which card).
 *   2. Load all enabled Automations for the org (board-scoped first, then org-wide).
 *   3. For each matching automation evaluate trigger + conditions.
 *   4. Execute every configured action in sequence.
 *   5. Write an AutomationLog row (success or error).
 */

import { db } from "@/lib/db";
import { Priority } from "@prisma/client";
import type {
  TriggerType,
  ActionType,
  TriggerConfig,
  ActionConfig,
} from "@/actions/automation-actions";

// ─── Event shapes ─────────────────────────────────────────────────────────────

export interface AutomationEvent {
  type: TriggerType;
  orgId: string;
  boardId: string;
  cardId: string;
  /** Additional context depending on event type */
  context?: {
    fromListId?: string;   // CARD_MOVED  – list moved FROM
    toListId?: string;     // CARD_MOVED  – list moved TO
    labelId?: string;      // LABEL_ADDED
    assigneeId?: string;   // MEMBER_ASSIGNED
    priority?: Priority;   // PRIORITY_CHANGED
    dueDate?: Date | null; // CARD_DUE_SOON / CARD_OVERDUE
    cardTitle?: string;    // CARD_TITLE_CONTAINS
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fire-and-forget: run all matching automations for an event.
 * Never throw — any error is caught and logged.
 */
export async function runAutomations(event: AutomationEvent): Promise<void> {
  try {
    // Load enabled automations scoped to this board OR org-wide (boardId == null)
    const automations = await db.automation.findMany({
      where: {
        orgId: event.orgId,
        isEnabled: true,
        OR: [
          { boardId: event.boardId },
          { boardId: null },
        ],
      },
    });

    if (automations.length === 0) return;

    // Fetch the card once so actions can reference it
    const card = await db.card.findUnique({
      where: { id: event.cardId },
      include: {
        list: { select: { id: true, title: true, boardId: true } },
        labels: { include: { label: true } },
        checklists: { include: { items: true } },
      },
    });
    if (!card) return;

    // Evaluate each automation
    await Promise.allSettled(
      automations.map((automation) =>
        evaluateAndExecute(event, card, automation)
      )
    );
  } catch (err) {
    // Never let engine failure surface to the caller
    console.error("[AutomationEngine] Fatal error – aborting silently", err);
  }
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateAndExecute(event: AutomationEvent, card: any, automation: any) {
  const trigger = automation.trigger as TriggerConfig;
  const actions = automation.actions as ActionConfig[];
  // conditions is an array of {field, op, value} — simple for now
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = Array.isArray(automation.conditions) ? automation.conditions : [];

  let matched = false;
  try {
    matched = triggerMatches(trigger, event) && conditionsPass(conditions, card, event);
  } catch {
    return; // don't run if evaluation errors
  }

  if (!matched) return;

  // Execute all actions
  let success = true;
  let errorMsg: string | undefined;
  try {
    for (const action of actions) {
      await executeAction(action, event, card);
    }
  } catch (err) {
    success = false;
    errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AutomationEngine] action failed for "${automation.name}":`, err);
  }

  // Write log
  try {
    await db.automationLog.create({
      data: {
        automationId: automation.id,
        cardId: event.cardId,
        success,
        error: errorMsg ?? null,
      },
    });

    if (success) {
      await db.automation.update({
        where: { id: automation.id },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
        },
      });
    }
  } catch {
    // Log write failures are non-fatal
  }
}

// ─── Trigger matching ─────────────────────────────────────────────────────────

function triggerMatches(trigger: TriggerConfig, event: AutomationEvent): boolean {
  if (trigger.type !== event.type) return false;

  switch (trigger.type) {
    case "CARD_MOVED":
      // Optionally constrain which list the card was moved FROM
      if (trigger.listId && event.context?.fromListId !== trigger.listId) return false;
      return true;

    case "LABEL_ADDED":
      if (trigger.labelId && event.context?.labelId !== trigger.labelId) return false;
      return true;

    case "MEMBER_ASSIGNED":
    case "PRIORITY_CHANGED":
    case "CARD_CREATED":
    case "CHECKLIST_COMPLETED":
    case "CARD_OVERDUE":
      return true;

    case "CARD_DUE_SOON": {
      const days = trigger.daysBeforeDue ?? 1;
      const dueDate = event.context?.dueDate;
      if (!dueDate) return false;
      const msUntilDue = dueDate.getTime() - Date.now();
      const hoursUntilDue = msUntilDue / (1000 * 60 * 60);
      return hoursUntilDue <= days * 24 && hoursUntilDue >= 0;
    }

    case "CARD_TITLE_CONTAINS":
      if (!trigger.keyword) return false;
      return event.context?.cardTitle?.toLowerCase().includes(trigger.keyword.toLowerCase()) ?? false;

    default:
      return false;
  }
}

// ─── Condition evaluation ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function conditionsPass(conditions: any[], card: any, _event: AutomationEvent): boolean {
  // Empty conditions mean "always pass"
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((cond) => {
    const { field, op, value } = cond;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardValue: any = card[field];
    switch (op) {
      case "eq":   return cardValue === value;
      case "neq":  return cardValue !== value;
      case "contains":
        return typeof cardValue === "string" && cardValue.toLowerCase().includes(String(value).toLowerCase());
      case "not_contains":
        return typeof cardValue === "string" && !cardValue.toLowerCase().includes(String(value).toLowerCase());
      case "gt":   return typeof cardValue === "number" && cardValue > Number(value);
      case "lt":   return typeof cardValue === "number" && cardValue < Number(value);
      case "is_null":   return cardValue == null;
      case "is_not_null": return cardValue != null;
      default:     return true; // unknown op → pass
    }
  });
}

// ─── Action execution ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(action: ActionConfig, event: AutomationEvent, card: any) {
  switch (action.type) {
    case "MOVE_CARD": {
      if (!action.listId) return;
      // Append to end of target list (place at max order + 1)
      const lastCard = await db.card.findFirst({
        where: { listId: action.listId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const newOrder = lastCard ? incrementOrder(lastCard.order) : "n";
      await db.card.update({
        where: { id: event.cardId },
        data: { listId: action.listId, order: newOrder },
      });
      break;
    }

    case "SET_PRIORITY": {
      if (!action.priority) return;
      await db.card.update({
        where: { id: event.cardId },
        data: { priority: action.priority as Priority },
      });
      break;
    }

    case "ASSIGN_MEMBER": {
      // action.assigneeId: DB user.id (not Clerk ID)
      if (action.assigneeId === undefined) return;
      await db.card.update({
        where: { id: event.cardId },
        data: { assigneeId: action.assigneeId ?? null },
      });
      break;
    }

    case "ADD_LABEL": {
      if (!action.labelId) return;
      // Idempotent upsert
      await db.cardLabelAssignment.upsert({
        where: { cardId_labelId: { cardId: event.cardId, labelId: action.labelId } },
        create: { cardId: event.cardId, labelId: action.labelId },
        update: {},
      });
      break;
    }

    case "REMOVE_LABEL": {
      if (!action.labelId) return;
      await db.cardLabelAssignment.deleteMany({
        where: { cardId: event.cardId, labelId: action.labelId },
      });
      break;
    }

    case "SET_DUE_DATE_OFFSET": {
      const offsetDays = action.daysOffset ?? 0;
      const base = card.dueDate ? new Date(card.dueDate) : new Date();
      const newDate = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      await db.card.update({
        where: { id: event.cardId },
        data: { dueDate: newDate },
      });
      break;
    }

    case "POST_COMMENT": {
      if (!action.comment) return;
      await db.comment.create({
        data: {
          text: action.comment,
          cardId: event.cardId,
          userId: "automation",
          userName: "Automation Bot",
          userImage: null,
          mentions: [],
          isDraft: false,
        },
      });
      break;
    }

    case "SEND_NOTIFICATION": {
      if (!action.notificationMessage || !card.assigneeId) return;
      // Notify the card assignee
      const assignedUser = await db.user.findFirst({
        where: { clerkUserId: card.assigneeId },
        select: { id: true, name: true },
      });
      if (!assignedUser) break;
      await db.notification.create({
        data: {
          orgId: event.orgId,
          userId: assignedUser.id,
          type: "MENTIONED",
          title: action.notificationMessage,
          body: `Card: ${card.title}`,
          entityType: "CARD",
          entityId: event.cardId,
          entityTitle: card.title,
          // actorId / actorName: treat automation as acting on behalf of the assignee
          actorId: assignedUser.id,
          actorName: "Automation",
        },
      });
      break;
    }

    case "COMPLETE_CHECKLIST_ITEM": {
      if (!action.checklistId) return;
      // Mark all items in the checklist as complete
      await db.checklistItem.updateMany({
        where: { checklistId: action.checklistId },
        data: { isComplete: true },
      });
      break;
    }

    default:
      console.warn("[AutomationEngine] Unknown action type:", (action as { type: string }).type);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Increment a LexoRank-style order string by appending "n" (mid of alphabet).
 * Works as a simple "append to end" when we just want to place a card last.
 */
function incrementOrder(order: string): string {
  // Simple approach: append "|" to sort after the current last item
  return order + "|";
}
