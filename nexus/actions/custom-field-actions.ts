"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CustomFieldType } from "@prisma/client";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateFieldSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["TEXT", "NUMBER", "DATE", "CHECKBOX", "SELECT", "MULTI_SELECT", "URL", "EMAIL", "PHONE"] as const),
  boardId: z.string().uuid().optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
});

const SetValueSchema = z.object({
  fieldId: z.string().uuid(),
  cardId: z.string().uuid(),
  valueText: z.string().optional(),
  valueNumber: z.number().optional(),
  valueDate: z.string().datetime().optional(),
  valueBoolean: z.boolean().optional(),
  valueOptions: z.array(z.string()).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getCustomFieldsForBoard(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const fields = await db.customField.findMany({
      where: { boardId, orgId: ctx.orgId },
      orderBy: { order: "asc" },
    });

    return { data: fields };
  } catch (e) {
    console.error("[GET_CUSTOM_FIELDS]", e);
    return { error: "Failed to load custom fields." };
  }
}

export async function getCardCustomFieldValues(cardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const card = await db.card.findFirst({
      where: { id: cardId, list: { board: { orgId: ctx.orgId } } },
    });
    if (!card) return { error: "Card not found." };

    const values = await db.customFieldValue.findMany({
      where: { cardId },
      include: { field: true },
    });

    return { data: values };
  } catch (e) {
    console.error("[GET_CARD_CUSTOM_FIELD_VALUES]", e);
    return { error: "Failed to load custom field values." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCustomField(
  name: string,
  type: CustomFieldType,
  boardId?: string,
  options?: string[],
  isRequired: boolean = false
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateFieldSchema.parse({ name, type, boardId, options, isRequired });

    // Get max order
    const maxOrder = await db.customField.aggregate({
      where: { orgId: ctx.orgId, boardId: validated.boardId },
      _max: { order: true },
    });

    const field = await db.customField.create({
      data: {
        orgId: ctx.orgId,
        boardId: validated.boardId,
        name: validated.name,
        type: validated.type,
        options: validated.options ? validated.options : undefined,
        isRequired: validated.isRequired,
        order: (maxOrder._max.order ?? 0) + 1,
      },
    });

    return { data: field };
  } catch (e) {
    console.error("[CREATE_CUSTOM_FIELD]", e);
    return { error: "Failed to create custom field." };
  }
}

export async function deleteCustomField(fieldId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const field = await db.customField.findFirst({
      where: { id: fieldId, orgId: ctx.orgId },
    });
    if (!field) return { error: "Field not found." };

    await db.customField.delete({ where: { id: fieldId } });
    return { data: true };
  } catch (e) {
    console.error("[DELETE_CUSTOM_FIELD]", e);
    return { error: "Failed to delete custom field." };
  }
}

export async function setCustomFieldValue(
  fieldId: string,
  cardId: string,
  value: {
    valueText?: string;
    valueNumber?: number;
    valueDate?: string;
    valueBoolean?: boolean;
    valueOptions?: string[];
  }
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = SetValueSchema.parse({ fieldId, cardId, ...value });

    // Verify card and field ownership
    const [card, field] = await Promise.all([
      db.card.findFirst({ where: { id: validated.cardId, list: { board: { orgId: ctx.orgId } } } }),
      db.customField.findFirst({ where: { id: validated.fieldId, orgId: ctx.orgId } }),
    ]);
    if (!card || !field) return { error: "Card or field not found." };

    const cfv = await db.customFieldValue.upsert({
      where: { fieldId_cardId: { fieldId: validated.fieldId, cardId: validated.cardId } },
      create: {
        fieldId: validated.fieldId,
        cardId: validated.cardId,
        valueText: validated.valueText,
        valueNumber: validated.valueNumber,
        valueDate: validated.valueDate ? new Date(validated.valueDate) : undefined,
        valueBoolean: validated.valueBoolean,
        valueOptions: validated.valueOptions ?? [],
      },
      update: {
        valueText: validated.valueText,
        valueNumber: validated.valueNumber,
        valueDate: validated.valueDate ? new Date(validated.valueDate) : undefined,
        valueBoolean: validated.valueBoolean,
        valueOptions: validated.valueOptions ?? [],
      },
    });

    return { data: cfv };
  } catch (e) {
    console.error("[SET_CUSTOM_FIELD_VALUE]", e);
    return { error: "Failed to set custom field value." };
  }
}

export async function clearCustomFieldValue(fieldId: string, cardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    await db.customFieldValue.deleteMany({
      where: {
        fieldId,
        cardId,
        field: { orgId: ctx.orgId },
        card: { list: { board: { orgId: ctx.orgId } } },
      },
    });

    return { data: true };
  } catch (e) {
    console.error("[CLEAR_CUSTOM_FIELD_VALUE]", e);
    return { error: "Failed to clear custom field value." };
  }
}
