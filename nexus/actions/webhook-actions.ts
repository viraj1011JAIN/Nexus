"use server";

import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import crypto from "crypto";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const WebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

export const WEBHOOK_EVENTS = [
  { value: "card.created", label: "Card Created" },
  { value: "card.updated", label: "Card Updated" },
  { value: "card.deleted", label: "Card Deleted" },
  { value: "card.moved", label: "Card Moved" },
  { value: "comment.created", label: "Comment Added" },
  { value: "board.created", label: "Board Created" },
  { value: "sprint.started", label: "Sprint Started" },
  { value: "sprint.completed", label: "Sprint Completed" },
  { value: "member.invited", label: "Member Invited" },
];

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getWebhooks() {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);

    const webhooks = await db.webhook.findMany({
      where: { orgId: ctx.orgId },
      include: {
        _count: { select: { deliveries: true } },
        deliveries: {
          orderBy: { attemptedAt: "desc" },
          take: 5,
          select: {
            id: true,
            event: true,
            statusCode: true,
            success: true,
            duration: true,
            attemptedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: webhooks };
  } catch (e) {
    console.error("[GET_WEBHOOKS]", e);
    return { error: "Failed to load webhooks." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createWebhook(url: string, events: string[]) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = WebhookSchema.parse({ url, events });

    // Generate signing secret
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    const webhook = await db.webhook.create({
      data: {
        orgId: ctx.orgId,
        url: validated.url,
        events: validated.events,
        secret,
        isEnabled: true,
      },
    });

    return { data: { ...webhook, secret } };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Validation error." };
    console.error("[CREATE_WEBHOOK]", e);
    return { error: "Failed to create webhook." };
  }
}

export async function updateWebhook(webhookId: string, updates: { url?: string; events?: string[]; isEnabled?: boolean }) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.webhook.findFirst({
      where: { id: webhookId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Webhook not found." };

    if (updates.url) WebhookSchema.shape.url.parse(updates.url);

    const updated = await db.webhook.update({
      where: { id: webhookId },
      data: {
        ...(updates.url && { url: updates.url }),
        ...(updates.events && { events: updates.events }),
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
      },
    });

    return { data: updated };
  } catch (e) {
    console.error("[UPDATE_WEBHOOK]", e);
    return { error: "Failed to update webhook." };
  }
}

export async function deleteWebhook(webhookId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.webhook.findFirst({
      where: { id: webhookId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Webhook not found." };

    await db.webhook.delete({ where: { id: webhookId } });
    return { data: true };
  } catch (e) {
    console.error("[DELETE_WEBHOOK]", e);
    return { error: "Failed to delete webhook." };
  }
}

export async function rotateWebhookSecret(webhookId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.webhook.findFirst({
      where: { id: webhookId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "Webhook not found." };

    const newSecret = `whsec_${crypto.randomBytes(32).toString("hex")}`;
    await db.webhook.update({
      where: { id: webhookId },
      data: { secret: newSecret },
    });

    return { data: { secret: newSecret } };
  } catch (e) {
    console.error("[ROTATE_WEBHOOK_SECRET]", e);
    return { error: "Failed to rotate secret." };
  }
}
