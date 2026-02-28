"use server";
import "server-only";

import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LogTimeSchema = z.object({
  cardId: z.string().uuid(),
  minutes: z.number().int().min(1).max(100000),
  description: z.string().max(500).optional(),
  loggedAt: z.string().datetime().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyCardOwnership(cardId: string, orgId: string) {
  return db.card.findFirst({
    where: { id: cardId, list: { board: { orgId } } },
    select: { id: true, estimatedMinutes: true },
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getTimeLogs(cardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const card = await verifyCardOwnership(cardId, ctx.orgId);
    if (!card) return { error: "Card not found." };

    const logs = await db.timeLog.findMany({
      where: { cardId },
      include: {
        user: { select: { id: true, name: true, imageUrl: true } },
      },
      orderBy: { loggedAt: "desc" },
    });

    // Sum total minutes
    const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0);

    return { data: { logs, totalMinutes, estimatedMinutes: card.estimatedMinutes } };
  } catch (e) {
    console.error("[GET_TIME_LOGS]", e);
    return { error: "Failed to load time logs." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function logTime(cardId: string, minutes: number, description?: string, loggedAt?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = LogTimeSchema.parse({ cardId, minutes, description, loggedAt });

    const card = await verifyCardOwnership(validated.cardId, ctx.orgId);
    if (!card) return { error: "Card not found." };

    const timeLog = await db.timeLog.create({
      data: {
        cardId: validated.cardId,
        userId: ctx.userId,
        minutes: validated.minutes,
        description: validated.description,
        loggedAt: validated.loggedAt ? new Date(validated.loggedAt) : new Date(),
        orgId: ctx.orgId,
      },
    });

    return { data: timeLog };
  } catch (e) {
    console.error("[LOG_TIME]", e);
    return { error: "Failed to log time." };
  }
}

export async function updateTimeLog(timeLogId: string, minutes: number, description?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.timeLog.findFirst({
      where: { id: timeLogId, userId: ctx.userId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Time log not found." };

    await db.timeLog.update({
      where: { id: timeLogId },
      data: { minutes, description },
    });

    return { data: true };
  } catch (e) {
    console.error("[UPDATE_TIME_LOG]", e);
    return { error: "Failed to update time log." };
  }
}

export async function deleteTimeLog(timeLogId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.timeLog.findFirst({
      where: { id: timeLogId, userId: ctx.userId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Time log not found." };

    await db.timeLog.delete({ where: { id: timeLogId } });
    return { data: true };
  } catch (e) {
    console.error("[DELETE_TIME_LOG]", e);
    return { error: "Failed to delete time log." };
  }
}
