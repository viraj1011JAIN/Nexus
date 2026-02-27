"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { Priority } from "@prisma/client";

// ─── Automation Types ─────────────────────────────────────────────────────────

export type TriggerType =
  | "CARD_CREATED"
  | "CARD_MOVED"
  | "CARD_DELETED"
  | "CARD_DUE_SOON"
  | "CARD_OVERDUE"
  | "LABEL_ADDED"
  | "CHECKLIST_COMPLETED"
  | "MEMBER_ASSIGNED"
  | "PRIORITY_CHANGED"
  | "CARD_TITLE_CONTAINS";

export type ActionType =
  | "MOVE_CARD"
  | "SET_PRIORITY"
  | "ASSIGN_MEMBER"
  | "ADD_LABEL"
  | "REMOVE_LABEL"
  | "SET_DUE_DATE_OFFSET"
  | "POST_COMMENT"
  | "SEND_NOTIFICATION"
  | "COMPLETE_CHECKLIST";

export interface TriggerConfig {
  type: TriggerType;
  listId?: string;        // for CARD_MOVED (from list)
  labelId?: string;       // for LABEL_ADDED
  daysBeforeDue?: number; // for CARD_DUE_SOON
  keyword?: string;       // for CARD_TITLE_CONTAINS
}

export interface ActionConfig {
  type: ActionType;
  listId?: string;              // MOVE_CARD
  priority?: Priority;          // SET_PRIORITY
  assigneeId?: string;          // ASSIGN_MEMBER
  labelId?: string;             // ADD_LABEL / REMOVE_LABEL
  daysOffset?: number;          // SET_DUE_DATE_OFFSET
  comment?: string;             // POST_COMMENT
  notificationMessage?: string; // SEND_NOTIFICATION
  checklistId?: string;         // COMPLETE_CHECKLIST
  itemId?: string;              // COMPLETE_CHECKLIST (optional: target a specific item)
}

export interface ConditionConfig {
  field: "priority" | "listId" | "assigneeId" | "hasLabel" | "hasDueDate";
  operator: "equals" | "not_equals" | "exists" | "not_exists";
  value?: string;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const TriggerSchema = z.object({
  type: z.string(),
  listId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  daysBeforeDue: z.number().min(1).max(30).optional(),
  keyword: z.string().max(100).optional(),
});

const ActionSchema = z.object({
  type: z.string(),
  listId: z.string().uuid().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).optional(),
  assigneeId: z.string().optional(),
  labelId: z.string().uuid().optional(),
  daysOffset: z.number().min(-365).max(365).optional(),
  comment: z.string().max(500).optional(),
  notificationMessage: z.string().max(200).optional(),
  checklistId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
});

const ConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.string().optional(),
});

const CreateAutomationSchema = z.object({
  boardId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  trigger: TriggerSchema,
  conditions: z.array(ConditionSchema).default([]),
  actions: z.array(ActionSchema).min(1),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAutomations(boardId?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const automations = await db.automation.findMany({
      where: {
        orgId: ctx.orgId,
        ...(boardId ? { boardId } : {}),
      },
      include: {
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: automations };
  } catch (e) {
    console.error("[GET_AUTOMATIONS]", e);
    return { error: "Failed to load automations." };
  }
}

export async function getAutomationLogs(automationId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const automation = await db.automation.findFirst({
      where: { id: automationId, orgId: ctx.orgId },
    });
    if (!automation) return { error: "Not found." };

    const logs = await db.automationLog.findMany({
      where: { automationId },
      orderBy: { ranAt: "desc" },
      take: 50,
    });

    return { data: logs };
  } catch (e) {
    console.error("[GET_AUTOMATION_LOGS]", e);
    return { error: "Failed to load logs." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createAutomation(input: {
  boardId?: string;
  name: string;
  trigger: TriggerConfig;
  conditions?: ConditionConfig[];
  actions: ActionConfig[];
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateAutomationSchema.parse(input);

    if (validated.boardId) {
      const board = await db.board.findFirst({
        where: { id: validated.boardId, orgId: ctx.orgId },
      });
      if (!board) return { error: "Board not found." };
    }

    const automation = await db.automation.create({
      data: {
        orgId: ctx.orgId,
        boardId: validated.boardId,
        name: validated.name,
        trigger: validated.trigger as object,
        conditions: validated.conditions as object,
        actions: validated.actions as object,
        isEnabled: true,
      },
    });

    if (validated.boardId) revalidatePath(`/board/${validated.boardId}`);
    return { data: automation };
  } catch (e) {
    console.error("[CREATE_AUTOMATION]", e);
    return { error: "Failed to create automation." };
  }
}

export async function updateAutomation(
  id: string,
  input: Partial<{
    name: string;
    isEnabled: boolean;
    trigger: TriggerConfig;
    conditions: ConditionConfig[];
    actions: ActionConfig[];
  }>
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const automation = await db.automation.findFirst({
      where: { id, orgId: ctx.orgId },
    });
    if (!automation) return { error: "Automation not found." };

    // Validate config fields before persisting
    let validatedTrigger: object | undefined;
    let validatedConditions: object | undefined;
    let validatedActions: object | undefined;

    if (input.trigger !== undefined) {
      const parsed = TriggerSchema.safeParse(input.trigger);
      if (!parsed.success) return { error: "Invalid trigger configuration." };
      validatedTrigger = parsed.data as object;
    }
    if (input.conditions !== undefined) {
      const parsed = z.array(ConditionSchema).safeParse(input.conditions);
      if (!parsed.success) return { error: "Invalid conditions configuration." };
      validatedConditions = parsed.data as object;
    }
    if (input.actions !== undefined) {
      const parsed = z.array(ActionSchema).min(1).safeParse(input.actions);
      if (!parsed.success) return { error: "Invalid actions configuration." };
      validatedActions = parsed.data as object;
    }

    const updated = await db.automation.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(validatedTrigger !== undefined ? { trigger: validatedTrigger } : {}),
        ...(validatedConditions !== undefined ? { conditions: validatedConditions } : {}),
        ...(validatedActions !== undefined ? { actions: validatedActions } : {}),
      },
    });

    if (automation.boardId) revalidatePath(`/board/${automation.boardId}`);
    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_AUTOMATION]", e);
    return { error: "Failed to update automation." };
  }
}

export async function deleteAutomation(id: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const automation = await db.automation.findFirst({
      where: { id, orgId: ctx.orgId },
    });
    if (!automation) return { error: "Automation not found." };

    await db.automation.delete({ where: { id } });
    if (automation.boardId) revalidatePath(`/board/${automation.boardId}`);
    return { data: true };
  } catch (_e) {
    return { error: "Failed to delete automation." };
  }
}

// ─── Automation Engine (triggered from server side) ───────────────────────────

/**
 * Fire automations for a given trigger event.
 * Call this from card mutations (create, move, etc.)
 */
export async function fireAutomations(
  orgId: string,
  boardId: string,
  triggerType: TriggerType,
  context: {
    cardId: string;
    fromListId?: string;
    toListId?: string;
    labelId?: string;
    keyword?: string;
    priority?: string;
    assigneeId?: string;
  }
): Promise<void> {
  try {
    const automations = await db.automation.findMany({
      where: {
        orgId,
        isEnabled: true,
        OR: [{ boardId }, { boardId: null }],
      },
    });

    for (const automation of automations) {
      const trigger = automation.trigger as unknown as TriggerConfig;
      if (trigger.type !== triggerType) continue;

      // Check trigger-specific conditions
      if (trigger.type === "CARD_MOVED" && trigger.listId) {
        if (context.toListId !== trigger.listId) continue;
      }
      if (trigger.type === "LABEL_ADDED" && trigger.labelId) {
        if (context.labelId !== trigger.labelId) continue;
      }
      if (trigger.type === "CARD_TITLE_CONTAINS" && trigger.keyword) {
        const card = await db.card.findFirst({ where: { id: context.cardId }, select: { title: true } });
        if (!card?.title.toLowerCase().includes(trigger.keyword.toLowerCase())) continue;
      }

      // Check conditions
      const conditions = automation.conditions as unknown as ConditionConfig[];
      let conditionsMet = true;
      if (conditions.length > 0) {
        const card = await db.card.findFirst({
          where: { id: context.cardId },
          include: { labels: true },
        });
        if (!card) continue;

        for (const cond of conditions) {
          if (cond.field === "priority") {
            const match = cond.operator === "equals"
              ? card.priority === cond.value
              : card.priority !== cond.value;
            if (!match) { conditionsMet = false; break; }
          }
          if (cond.field === "hasDueDate") {
            const match = cond.operator === "exists" ? !!card.dueDate : !card.dueDate;
            if (!match) { conditionsMet = false; break; }
          }
          if (cond.field === "hasLabel" && cond.value) {
            const hasIt = card.labels.some((l) => l.labelId === cond.value);
            const match = cond.operator === "exists" ? hasIt : !hasIt;
            if (!match) { conditionsMet = false; break; }
          }
          if (cond.field === "listId") {
            const match = cond.operator === "equals"
              ? card.listId === cond.value
              : card.listId !== cond.value;
            if (!match) { conditionsMet = false; break; }
          }
          if (cond.field === "assigneeId") {
            const hasAssignee = cond.value ? card.assigneeId === cond.value : !!card.assigneeId;
            const match = cond.operator === "exists" ? hasAssignee : !hasAssignee;
            if (!match) { conditionsMet = false; break; }
          }
        }
      }
      if (!conditionsMet) continue;

      // Execute actions
      const actions = automation.actions as unknown as ActionConfig[];
      let success = true;
      let errorMsg: string | undefined;

      try {
        for (const action of actions) {
          await executeAction(context.cardId, boardId, orgId, action);
        }
      } catch (e) {
        success = false;
        errorMsg = e instanceof Error ? e.message : "Unknown error";
      }

      // Log execution
      await db.automationLog.create({
        data: {
          automationId: automation.id,
          cardId: context.cardId,
          success,
          error: errorMsg,
        },
      });

      // Update run count
      await db.automation.update({
        where: { id: automation.id },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
        },
      });
    }
  } catch (e) {
    console.error("[FIRE_AUTOMATIONS]", e);
    // Never throw — automation failures should be silent
  }
}

async function executeAction(
  cardId: string,
  boardId: string,
  orgId: string,
  action: ActionConfig
): Promise<void> {
  switch (action.type) {
    case "MOVE_CARD":
      if (action.listId) {
        // Use a timestamp-based key so the order string stays bounded (~8 chars)
        const newOrder = Date.now().toString(36);
        await db.card.update({
          where: { id: cardId },
          data: { listId: action.listId, order: newOrder },
        });
      }
      break;

    case "SET_PRIORITY":
      if (action.priority) {
        await db.card.update({ where: { id: cardId }, data: { priority: action.priority } });
      }
      break;

    case "ASSIGN_MEMBER":
      if (action.assigneeId !== undefined) {
        await db.card.update({ where: { id: cardId }, data: { assigneeId: action.assigneeId } });
      }
      break;

    case "ADD_LABEL":
      if (action.labelId) {
        await db.cardLabelAssignment.upsert({
          where: { cardId_labelId: { cardId, labelId: action.labelId } },
          create: { cardId, labelId: action.labelId },
          update: {},
        });
      }
      break;

    case "REMOVE_LABEL":
      if (action.labelId) {
        await db.cardLabelAssignment.deleteMany({ where: { cardId, labelId: action.labelId } });
      }
      break;

    case "SET_DUE_DATE_OFFSET":
      if (action.daysOffset !== undefined) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + action.daysOffset);
        await db.card.update({ where: { id: cardId }, data: { dueDate } });
      }
      break;

    case "POST_COMMENT":
      if (action.comment) {
        await db.comment.create({
          data: {
            cardId,
            userId: "automation",
            userName: "Automation",
            text: `🤖 Automation: ${action.comment}`,
          },
        });
      }
      break;

    case "SEND_NOTIFICATION":
      if (action.notificationMessage) {
        const card = await db.card.findFirst({ where: { id: cardId }, select: { assigneeId: true } });
        if (card?.assigneeId) {
          // Use the recipient as the actor placeholder — a system user id is preferred
          // when available via an env variable (SYSTEM_USER_ID), otherwise re-use recipient
          const systemActorId = process.env.SYSTEM_USER_ID ?? card.assigneeId;
          await db.notification.create({
            data: {
              orgId,
              userId: card.assigneeId,
              type: "MENTIONED",
              title: "Automation notification",
              body: action.notificationMessage,
              entityType: "card",
              entityId: cardId,
              actorId: systemActorId,
              actorName: "Automation",
            },
          });
        }
      }
      break;

    case "COMPLETE_CHECKLIST_ITEM" as ActionType:
    case "COMPLETE_CHECKLIST":
      if (action.checklistId) {
        // Mark a specific item (if itemId given) or all incomplete items on the checklist
        await db.checklistItem.updateMany({
          where: {
            checklistId: action.checklistId,
            ...(action.itemId ? { id: action.itemId } : {}),
            isComplete: false,
          },
          data: {
            isComplete: true,
            completedAt: new Date(),
          },
        });
      }
      break;

    default:
      break;
  }
}
