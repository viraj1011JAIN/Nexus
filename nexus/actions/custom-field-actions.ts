"use server";
import "server-only";

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
  options: z.array(z.string().min(1).max(100)).max(100).optional(),
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

const UpdateFieldSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name too long").optional(),
  isRequired: z.boolean().optional(),
  options: z.array(z.string().min(1).max(100)).max(100, "Too many options (max 100)").optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one field must be provided to update." }
);

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

    if (validated.boardId) {
      revalidatePath(`/board/${validated.boardId}`);
    }

    return { data: field };
  } catch (e) {
    console.error("[CREATE_CUSTOM_FIELD]", e);
    return { error: "Failed to create custom field." };
  }
}

export async function updateCustomField(
  fieldId: string,
  data: { name?: string; isRequired?: boolean; options?: string[] }
) {
  try {
    // Validate fieldId as a UUID before any DB access to short-circuit invalid IDs.
    const fieldIdParseResult = z.string().uuid("fieldId must be a valid UUID").safeParse(fieldId);
    if (!fieldIdParseResult.success) {
      return { error: fieldIdParseResult.error.issues[0]?.message ?? "Invalid field ID." };
    }

    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    // Validate update payload before any DB access — surface Zod messages to the caller
    const parseResult = UpdateFieldSchema.safeParse(data);
    if (!parseResult.success) {
      // Return the first validation issue message (inc. the refine "At least one field" message)
      const firstIssue = parseResult.error.issues[0];
      return { error: firstIssue?.message ?? "Invalid update data." };
    }
    const validated = parseResult.data;

    const existing = await db.customField.findFirst({
      where: { id: fieldId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Field not found." };

    // Field types that support an options array (SELECT / MULTI_SELECT variants).
    const OPTION_TYPES = new Set(["SELECT", "MULTI_SELECT"]);
    // Providing options for a field type that doesn't support them would silently
    // overwrite the stored options array with unrelated data.
    if (validated.options !== undefined && !OPTION_TYPES.has(existing.type)) {
      return { error: `Options are not supported for field type "${existing.type}".` };
    }

    const field = await db.customField.update({
      where: { id: fieldId },
      data: {
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.isRequired !== undefined ? { isRequired: validated.isRequired } : {}),
        ...(validated.options !== undefined && OPTION_TYPES.has(existing.type) ? { options: validated.options } : {}),
      },
    });

    if (existing.boardId) {
      revalidatePath(`/board/${existing.boardId}`);
    }

    return { data: field };
  } catch (e) {
    console.error("[UPDATE_CUSTOM_FIELD]", e);
    return { error: "Failed to update custom field." };
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

    if (field.boardId) {
      revalidatePath(`/board/${field.boardId}`);
    }

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
      db.card.findFirst({
        where: { id: validated.cardId, list: { board: { orgId: ctx.orgId } } },
        select: { id: true, list: { select: { boardId: true } } },
      }),
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

    revalidatePath(`/board/${card.list.boardId}`);

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

    const cardForPath = await db.card.findFirst({
      where: { id: cardId, list: { board: { orgId: ctx.orgId } } },
      select: { list: { select: { boardId: true } } },
    });

    await db.customFieldValue.deleteMany({
      where: {
        fieldId,
        cardId,
        field: { orgId: ctx.orgId },
        card: { list: { board: { orgId: ctx.orgId } } },
      },
    });

    if (cardForPath) {
      revalidatePath(`/board/${cardForPath.list.boardId}`);
    }

    return { data: true };
  } catch (e) {
    console.error("[CLEAR_CUSTOM_FIELD_VALUE]", e);
    return { error: "Failed to clear custom field value." };
  }
}
