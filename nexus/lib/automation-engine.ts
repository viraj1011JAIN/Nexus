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
    let card = await db.card.findUnique({
      where: { id: event.cardId },
      include: {
        list: { select: { id: true, title: true, boardId: true } },
        labels: { include: { label: true } },
        checklists: { include: { items: true } },
      },
    });
    if (!card) return;

    // Run automations sequentially so mutations by one automation are visible to the
    // next (e.g. ASSIGN_MEMBER followed by SEND_NOTIFICATION sees the updated assigneeId).
    for (const automation of automations) {
      await evaluateAndExecute(event, card, automation);
      // Re-fetch card so the next automation in the sequence operates on the latest state
      const refreshed = await db.card.findUnique({
        where: { id: event.cardId },
        include: {
          list: { select: { id: true, title: true, boardId: true } },
          labels: { include: { label: true } },
          checklists: { include: { items: true } },
        },
      });
      // If the card was deleted mid-sequence, stop running further automations
      if (!refreshed) break;
      card = refreshed;
    }
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

  // Execute all actions, re-fetching the card after each mutating action so
  // sequential actions (e.g. ASSIGN_MEMBER → SEND_NOTIFICATION) see the latest state.
  let success = true;
  let errorMsg: string | undefined;
  try {
    for (const action of actions) {
      await executeAction(action, event, card);
      // Re-fetch for actions that mutate card state (including relation changes)
      const mutatingTypes: ActionType[] = [
        "MOVE_CARD", "SET_PRIORITY", "ASSIGN_MEMBER", "SET_DUE_DATE_OFFSET",
        "ADD_LABEL", "REMOVE_LABEL", "COMPLETE_CHECKLIST",
      ];
      if (mutatingTypes.includes(action.type)) {
        const refreshed = await db.card.findUnique({
          where: { id: event.cardId },
          include: {
            list: { select: { id: true, title: true, boardId: true } },
            labels: { include: { label: true } },
            checklists: { include: { items: true } },
          },
        });
        if (refreshed) card = refreshed;
      }
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

    case "CARD_DELETED":
      // CARD_DELETED fires a webhook but doesn't trigger automation execution
      return false;

    case "CARD_DUE_SOON": {
      const days = trigger.daysBeforeDue ?? 1;
      const rawDueDate = event.context?.dueDate;
      if (!rawDueDate) return false;
      // dueDate may arrive as a Date object or a serialized ISO-8601 string
      const dueDate = new Date(rawDueDate);
      if (isNaN(dueDate.getTime())) return false;
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
      case "eq": {
        // Type-coerce: compare numbers as numbers, booleans as booleans
        if (typeof cardValue === "number") return cardValue === Number(value);
        if (typeof cardValue === "boolean") return cardValue === (value === "true");
        // eslint-disable-next-line eqeqeq
        return cardValue == value;
      }
      case "neq": {
        if (typeof cardValue === "number") return cardValue !== Number(value);
        if (typeof cardValue === "boolean") return cardValue !== (value === "true");
        // eslint-disable-next-line eqeqeq
        return cardValue != value;
      }
      case "contains":
        return typeof cardValue === "string" && cardValue.toLowerCase().includes(String(value).toLowerCase());
      case "not_contains":
        // null/undefined or non-string values do NOT contain the substring → true
        if (typeof cardValue !== "string") return true;
        return !cardValue.toLowerCase().includes(String(value).toLowerCase());
      case "gt":   return typeof cardValue === "number" && cardValue > Number(value);
      case "lt":   return typeof cardValue === "number" && cardValue < Number(value);
      case "is_null":   return cardValue == null;
      case "is_not_null": return cardValue != null;
      default:
        console.warn("[AutomationEngine] Unknown condition op:", op);
        return false; // fail-safe: unknown op → condition not met
    }
  });
}

// ─── Action execution ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(action: ActionConfig, event: AutomationEvent, card: any) {
  // CARD_DELETED automations never reach here (triggerMatches returns false),
  // but guard defensively: only allow safe side-effect actions when card may not exist.
  if (event.type === "CARD_DELETED") {
    // POST_COMMENT is also unsafe — it writes a comment.cardId FK referencing the deleted card
    const safeTypes: ActionType[] = ["SEND_NOTIFICATION"];
    if (!safeTypes.includes(action.type)) return;
  }
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
      // Comment.userId is a required FK — we need a real user row.
      // Configure SYSTEM_USER_ID in env to point to a dedicated automation user.
      // If unset we skip comment creation rather than violating the FK constraint.
      const systemUserId = process.env.SYSTEM_USER_ID;
      if (!systemUserId) {
        console.warn(
          "[AutomationEngine] POST_COMMENT skipped: SYSTEM_USER_ID env var is not set. "
          + "Create a dedicated automation user and set its DB id in SYSTEM_USER_ID."
        );
        return;
      }
      await db.comment.create({
        data: {
          text: action.comment,
          cardId: event.cardId,
          userId: systemUserId,
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
      // card.assigneeId stores the DB user.id (set by ASSIGN_MEMBER which stores action.assigneeId
      // directly). Query by primary key, not by clerkUserId.
      const assignedUser = await db.user.findFirst({
        where: { id: card.assigneeId },
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
          // actorId: prefer a dedicated system/automation user if configured;
          // fall back to the assignee's own id to satisfy the non-nullable FK.
          actorId: process.env.SYSTEM_USER_ID ?? assignedUser.id,
          actorName: "Automation",
        },
      });
      break;
    }

    case "COMPLETE_CHECKLIST": {
      if (!action.checklistId) return;
      // Mark all incomplete items in the checklist as complete.
      // "COMPLETE_CHECKLIST" completes the entire checklist; for single-item targeting
      // callers should use action.itemId (which is passed through as-is in ActionConfig).
      await db.checklistItem.updateMany({
        where: {
          checklistId: action.checklistId,
          ...(action.itemId ? { id: action.itemId } : {}),
        },
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
 * Append '~' (0x7E, the highest printable ASCII character) to place a card
 * last in lexicographic order.  To prevent unbounded string growth, we cap at
 * a maximum length and reset to a compact timestamp-based rank.
 * For production use, integrate a full LexoRank library.
 */
function incrementOrder(order: string): string {
  const MAX_ORDER_LENGTH = 32;
  if (order.length >= MAX_ORDER_LENGTH) {
    // String has grown too long — fall back to a compact timestamp-based rank, prefixed
    // with \uFFFF so it always sorts AFTER any printable-ASCII-based order string.
    return "\uFFFF" + Date.now().toString(36);
  }
  // Append '~' (0x7E) which is the highest printable ASCII character,
  // ensuring this card sorts last among any standard order strings.
  return order + "~";
}
