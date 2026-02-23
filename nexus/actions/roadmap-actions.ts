"use server";

import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const InitiativeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  color: z.string().max(20).optional(),
});

const EpicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE", "CANCELLED"]).default("BACKLOG"),
  boardId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  color: z.string().max(20).optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getInitiatives() {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const initiatives = await db.initiative.findMany({
      where: { orgId: ctx.orgId },
      include: {
        epics: {
          include: {
            _count: { select: { cards: true } },
            cards: {
              select: { id: true, storyPoints: true },
            },
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });

    return { data: initiatives };
  } catch (e) {
    console.error("[GET_INITIATIVES]", e);
    return { error: "Failed to load roadmap." };
  }
}

export async function getEpicsForBoard(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const epics = await db.epic.findMany({
      where: { boardId, orgId: ctx.orgId },
      include: {
        _count: { select: { cards: true } },
        cards: {
          select: { id: true, storyPoints: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return { data: epics };
  } catch (e) {
    console.error("[GET_EPICS]", e);
    return { error: "Failed to load epics." };
  }
}

// ─── Initiative Mutations ─────────────────────────────────────────────────────

export async function createInitiative(data: {
  title: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = InitiativeSchema.parse(data);

    const initiative = await db.initiative.create({
      data: {
        orgId: ctx.orgId,
        title: validated.title,
        description: validated.description,
        status: validated.status,
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        endDate: validated.endDate ? new Date(validated.endDate) : undefined,
        color: validated.color,
      },
    });

    revalidatePath("/roadmap");
    return { data: initiative };
  } catch (e) {
    console.error("[CREATE_INITIATIVE]", e);
    return { error: "Failed to create initiative." };
  }
}

export async function updateInitiative(id: string, data: {
  title?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.initiative.findFirst({ where: { id, orgId: ctx.orgId } });
    if (!existing) return { error: "Initiative not found." };

    const updated = await db.initiative.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });

    revalidatePath("/roadmap");
    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_INITIATIVE]", e);
    return { error: "Failed to update initiative." };
  }
}

export async function deleteInitiative(id: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    await db.initiative.delete({ where: { id } });
    revalidatePath("/roadmap");
    return { data: true };
  } catch (e) {
    console.error("[DELETE_INITIATIVE]", e);
    return { error: "Failed to delete initiative." };
  }
}

// ─── Epic Mutations ───────────────────────────────────────────────────────────

export async function createEpic(data: {
  title: string;
  description?: string;
  status?: string;
  boardId?: string;
  initiativeId?: string;
  startDate?: string;
  dueDate?: string;
  color?: string;
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = EpicSchema.parse(data);

    const epic = await db.epic.create({
      data: {
        orgId: ctx.orgId,
        boardId: validated.boardId,
        initiativeId: validated.initiativeId,
        title: validated.title,
        description: validated.description,
        status: validated.status ?? "BACKLOG",
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
        color: validated.color,
      },
    });

    revalidatePath("/roadmap");
    return { data: epic };
  } catch (e) {
    console.error("[CREATE_EPIC]", e);
    return { error: "Failed to create epic." };
  }
}

export async function updateEpic(id: string, data: {
  title?: string;
  description?: string;
  status?: string;
  startDate?: string;
  dueDate?: string;
  color?: string;
}) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.epic.findFirst({ where: { id, orgId: ctx.orgId } });
    if (!existing) return { error: "Epic not found." };

    const updated = await db.epic.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });

    revalidatePath("/roadmap");
    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_EPIC]", e);
    return { error: "Failed to update epic." };
  }
}
