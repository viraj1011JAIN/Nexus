"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateNotificationSchema = z.object({
  orgId: z.string(),
  userId: z.string(),          // recipient
  type: z.enum(["MENTIONED", "ASSIGNED", "CARD_DUE_SOON", "CARD_OVERDUE", "COMMENT_ON_ASSIGNED_CARD", "BOARD_SHARED", "SPRINT_STARTED", "DEPENDENCY_RESOLVED"] as const),
  title: z.string().max(200),
  body: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  entityTitle: z.string().optional(),
  actorId: z.string(),
  actorName: z.string(),
  actorImage: z.string().nullable().optional(),
});

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getNotifications() {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const notifications = await db.notification.findMany({
      where: { orgId: ctx.orgId, userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { data: notifications };
  } catch (e) {
    console.error("[GET_NOTIFICATIONS]", e);
    return { error: "Failed to load notifications." };
  }
}

export async function getUnreadNotificationCount() {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const count = await db.notification.count({
      where: { orgId: ctx.orgId, userId: ctx.userId, isRead: false },
    });

    return { data: count };
  } catch {
    return { data: 0 };
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    await db.notification.updateMany({
      where: { id: notificationId, userId: ctx.userId, orgId: ctx.orgId },
      data: { isRead: true },
    });

    revalidatePath(`/`);
    return { data: true };
  } catch (e) {
    console.error("[MARK_NOTIFICATION_READ]", e);
    return { error: "Failed to mark notification." };
  }
}

export async function markAllNotificationsRead() {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    await db.notification.updateMany({
      where: { userId: ctx.userId, orgId: ctx.orgId, isRead: false },
      data: { isRead: true },
    });

    revalidatePath(`/`);
    return { data: true };
  } catch (e) {
    console.error("[MARK_ALL_NOTIFICATIONS_READ]", e);
    return { error: "Failed to mark notifications." };
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    await db.notification.deleteMany({
      where: { id: notificationId, userId: ctx.userId, orgId: ctx.orgId },
    });

    return { data: true };
  } catch (e) {
    console.error("[DELETE_NOTIFICATION]", e);
    return { error: "Failed to delete notification." };
  }
}

// ─── Create (called internally by other server actions) ──────────────────────

export async function createNotification(data: z.infer<typeof CreateNotificationSchema>) {
  try {
    const validated = CreateNotificationSchema.parse(data);

    await db.notification.create({
      data: {
        orgId: validated.orgId,
        userId: validated.userId,
        type: validated.type,
        title: validated.title,
        body: validated.body,
        entityType: validated.entityType,
        entityId: validated.entityId,
        entityTitle: validated.entityTitle,
        actorId: validated.actorId,
        actorName: validated.actorName,
        actorImage: validated.actorImage,
        isRead: false,
      },
    });

    return { data: true };
  } catch (e) {
    console.error("[CREATE_NOTIFICATION]", e);
    return { error: "Failed to create notification." };
  }
}
