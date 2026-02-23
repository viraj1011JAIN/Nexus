"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { SprintStatus } from "@prisma/client";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateSprintSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(100),
  goal: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const UpdateSprintSchema = z.object({
  sprintId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getSprintsForBoard(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    // Verify board belongs to org
    const board = await db.board.findFirst({
      where: { id: boardId, orgId: ctx.orgId },
    });
    if (!board) return { error: "Board not found." };

    const sprints = await db.sprint.findMany({
      where: { boardId },
      include: {
        _count: { select: { cards: true } },
        cards: {
          select: {
            id: true,
            title: true,
            storyPoints: true,
            priority: true,
            dueDate: true,
            list: { select: { title: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
    });

    return { data: sprints };
  } catch (e) {
    console.error("[GET_SPRINTS]", e);
    return { error: "Failed to load sprints." };
  }
}

export async function getActiveSprint(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const sprint = await db.sprint.findFirst({
      where: { boardId, status: SprintStatus.ACTIVE },
      include: {
        cards: {
          select: {
            id: true,
            title: true,
            storyPoints: true,
            priority: true,
            dueDate: true,
            list: { select: { title: true } },
          },
        },
      },
    });

    return { data: sprint };
  } catch (e) {
    console.error("[GET_ACTIVE_SPRINT]", e);
    return { error: "Failed to load active sprint." };
  }
}

export async function getBacklogCards(boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const board = await db.board.findFirst({
      where: { id: boardId, orgId: ctx.orgId },
    });
    if (!board) return { error: "Board not found." };

    const cards = await db.card.findMany({
      where: {
        sprintId: null,
        list: { boardId },
      },
      select: {
        id: true,
        title: true,
        storyPoints: true,
        priority: true,
        dueDate: true,
        order: true,
        list: { select: { title: true, id: true } },
      },
      orderBy: [{ list: { order: "asc" } }, { order: "asc" }],
    });

    return { data: cards };
  } catch (e) {
    console.error("[GET_BACKLOG_CARDS]", e);
    return { error: "Failed to load backlog." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createSprint(boardId: string, name: string, goal?: string, startDate?: string, endDate?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateSprintSchema.parse({ boardId, name, goal, startDate, endDate });

    const board = await db.board.findFirst({
      where: { id: validated.boardId, orgId: ctx.orgId },
    });
    if (!board) return { error: "Board not found." };

    const sprint = await db.sprint.create({
      data: {
        boardId: validated.boardId,
        name: validated.name,
        goal: validated.goal,
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        endDate: validated.endDate ? new Date(validated.endDate) : undefined,
        status: SprintStatus.PLANNING,
      },
    });

    revalidatePath(`/board/${boardId}`);
    return { data: sprint };
  } catch (e) {
    console.error("[CREATE_SPRINT]", e);
    return { error: "Failed to create sprint." };
  }
}

export async function updateSprint(sprintId: string, updates: { name?: string; goal?: string; startDate?: string; endDate?: string }) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = UpdateSprintSchema.parse({ sprintId, ...updates });

    const sprint = await db.sprint.findFirst({
      where: { id: validated.sprintId, board: { orgId: ctx.orgId } },
    });
    if (!sprint) return { error: "Sprint not found." };

    const updated = await db.sprint.update({
      where: { id: validated.sprintId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.goal !== undefined && { goal: validated.goal }),
        ...(validated.startDate && { startDate: new Date(validated.startDate) }),
        ...(validated.endDate && { endDate: new Date(validated.endDate) }),
      },
    });

    revalidatePath(`/board/${sprint.boardId}`);
    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_SPRINT]", e);
    return { error: "Failed to update sprint." };
  }
}

export async function startSprint(sprintId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, board: { orgId: ctx.orgId } },
    });
    if (!sprint) return { error: "Sprint not found." };
    if (sprint.status !== SprintStatus.PLANNING) return { error: "Only planning sprints can be started." };

    // Only one active sprint per board
    const activeSprint = await db.sprint.findFirst({
      where: { boardId: sprint.boardId, status: SprintStatus.ACTIVE },
    });
    if (activeSprint) return { error: "A sprint is already active. Complete it first." };

    const updated = await db.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.ACTIVE,
        startDate: sprint.startDate ?? new Date(),
      },
    });

    revalidatePath(`/board/${sprint.boardId}`);
    return { data: updated };
  } catch (e) {
    console.error("[START_SPRINT]", e);
    return { error: "Failed to start sprint." };
  }
}

export async function completeSprint(sprintId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, board: { orgId: ctx.orgId } },
      include: { cards: true },
    });
    if (!sprint) return { error: "Sprint not found." };
    if (sprint.status !== SprintStatus.ACTIVE) return { error: "Only active sprints can be completed." };

    const updated = await db.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.COMPLETED,
        endDate: new Date(),
      },
    });

    // Unassign all remaining cards from this sprint — move to backlog
    await db.card.updateMany({
      where: { sprintId },
      data: { sprintId: null },
    });

    revalidatePath(`/board/${sprint.boardId}`);
    return { data: updated };
  } catch (e) {
    console.error("[COMPLETE_SPRINT]", e);
    return { error: "Failed to complete sprint." };
  }
}

export async function deleteSprint(sprintId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, board: { orgId: ctx.orgId } },
    });
    if (!sprint) return { error: "Sprint not found." };
    if (sprint.status === SprintStatus.ACTIVE) return { error: "Cannot delete an active sprint." };

    // Unassign cards
    await db.card.updateMany({ where: { sprintId }, data: { sprintId: null } });
    await db.sprint.delete({ where: { id: sprintId } });

    revalidatePath(`/board/${sprint.boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[DELETE_SPRINT]", e);
    return { error: "Failed to delete sprint." };
  }
}

export async function addCardToSprint(cardId: string, sprintId: string | null) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const card = await db.card.findFirst({
      where: { id: cardId, list: { board: { orgId: ctx.orgId } } },
    });
    if (!card) return { error: "Card not found." };

    if (sprintId) {
      const sprint = await db.sprint.findFirst({
        where: { id: sprintId, board: { orgId: ctx.orgId } },
      });
      if (!sprint) return { error: "Sprint not found." };
    }

    await db.card.update({
      where: { id: cardId },
      data: { sprintId },
    });

    return { data: true };
  } catch (e) {
    console.error("[ADD_CARD_TO_SPRINT]", e);
    return { error: "Failed to update card sprint." };
  }
}
