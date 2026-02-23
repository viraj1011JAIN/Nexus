"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateViewSchema = z.object({
  name: z.string().min(1).max(100),
  boardId: z.string().uuid().optional(),
  filters: z.record(z.string(), z.unknown()),
  viewType: z.enum(["kanban", "table", "calendar", "list"]).default("kanban"),
  isShared: z.boolean().default(false),
});

const UpdateViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  viewType: z.enum(["kanban", "table", "calendar", "list"]).optional(),
  isShared: z.boolean().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getSavedViews(boardId?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const views = await db.savedView.findMany({
      where: {
        orgId: ctx.orgId,
        ...(boardId ? { boardId } : {}),
        OR: [
          { userId: ctx.userId },
          { isShared: true },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    return { data: views };
  } catch (e) {
    console.error("[GET_SAVED_VIEWS]", e);
    return { error: "Failed to load saved views." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createSavedView(
  name: string,
  filters: Record<string, unknown>,
  viewType: string = "kanban",
  boardId?: string,
  isShared: boolean = false
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateViewSchema.parse({ name, filters, viewType, boardId, isShared });

    const view = await db.savedView.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        name: validated.name,
        filters: validated.filters as Prisma.InputJsonValue,
        viewType: validated.viewType,
        boardId: validated.boardId,
        isShared: validated.isShared,
      },
    });

    return { data: view };
  } catch (e) {
    console.error("[CREATE_SAVED_VIEW]", e);
    return { error: "Failed to create view." };
  }
}

export async function updateSavedView(
  viewId: string,
  updates: { name?: string; filters?: Record<string, unknown>; viewType?: string; isShared?: boolean }
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = UpdateViewSchema.parse({ viewId, ...updates });

    const existing = await db.savedView.findFirst({
      where: { id: validated.viewId, orgId: ctx.orgId, userId: ctx.userId },
    });
    if (!existing) return { error: "View not found." };

    const updated = await db.savedView.update({
      where: { id: validated.viewId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.filters && { filters: validated.filters as Prisma.InputJsonValue }),
        ...(validated.viewType && { viewType: validated.viewType }),
        ...(validated.isShared !== undefined && { isShared: validated.isShared }),
      },
    });

    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_SAVED_VIEW]", e);
    return { error: "Failed to update view." };
  }
}

export async function deleteSavedView(viewId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.savedView.findFirst({
      where: { id: viewId, orgId: ctx.orgId, userId: ctx.userId },
    });
    if (!existing) return { error: "View not found." };

    await db.savedView.delete({ where: { id: viewId } });
    return { data: true };
  } catch (e) {
    console.error("[DELETE_SAVED_VIEW]", e);
    return { error: "Failed to delete view." };
  }
}
