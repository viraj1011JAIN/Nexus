/**
 * Webhook Delivery Engine  (TASK-020)
 *
 * Fires outbound HTTP webhooks when board/card events occur.
 * Signature: HMAC-SHA256 of the JSON payload using the stored webhook secret,
 * delivered in the `X-Nexus-Signature-256` header (same pattern as GitHub).
 *
 * Called fire-and-forget from server actions — failures must NEVER surface.
 *
 * Architecture:
 *   1. Look up all enabled webhooks subscribed to the event.
 *   2. For each webhook, sign the payload and POST.
 *   3. Record every attempt in `WebhookDelivery` (success or failure).
 */

import crypto from "crypto";
import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: string;
  timestamp: string; // ISO-8601
  orgId: string;
  data: Record<string, unknown>;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fire all webhooks for `orgId` that are subscribed to `event`.
 * Never throws — all errors are caught and written to the delivery log.
 *
 * @param orgId  Organization owning the webhooks.
 * @param event  Event name, e.g. "card.created", "card.moved", "comment.created".
 * @param data   Event-specific payload fields.
 */
export async function fireWebhooks(
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await db.webhook.findMany({
      where: {
        orgId,
        isEnabled: true,
        events: { has: event },
      },
      select: {
        id: true,
        url: true,
        secret: true,
      },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      orgId,
      data,
    };

    const body = JSON.stringify(payload);

    await Promise.allSettled(
      webhooks.map((wh) => deliverSingle(wh, event, payload, body))
    );
  } catch (err) {
    console.error("[WebhookDelivery] Fatal error – aborting silently:", err);
  }
}

// ─── Single delivery ──────────────────────────────────────────────────────────

async function deliverSingle(
  webhook: { id: string; url: string; secret: string },
  event: string,
  payload: WebhookPayload,
  body: string
): Promise<void> {
  const startMs = Date.now();
  let statusCode: number | null = null;
  let success = false;

  try {
    const sig = sign(body, webhook.secret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

    let response: Response;
    try {
      response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Nexus-Webhook/1.0",
          "X-Nexus-Event": event,
          "X-Nexus-Signature-256": `sha256=${sig}`,
          "X-Nexus-Delivery": crypto.randomUUID(),
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    statusCode = response.status;
    // 2xx = success
    success = response.status >= 200 && response.status < 300;
  } catch (err) {
    // Network errors, timeouts, DNS failures — record as failure
    success = false;
    console.warn(`[WebhookDelivery] Delivery failed for webhook ${webhook.id}:`, err);
  }

  const duration = Date.now() - startMs;

  // Record delivery attempt (non-fatal)
  try {
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: JSON.parse(body) as object,
        statusCode,
        success,
        duration,
      },
    });
  } catch (dbErr) {
    console.error("[WebhookDelivery] Failed to save delivery record:", dbErr);
  }
}

// ─── HMAC signing ─────────────────────────────────────────────────────────────

/**
 * Returns HMAC-SHA256 hex digest of `body` using `secret`.
 * Callers include it as `sha256=<hex>` in the signature header.
 */
function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Utility: verify an incoming webhook signature.
 * Useful in API routes that receive webhooks from partner services.
 */
export function verifyWebhookSignature(
  body: string,
  secret: string,
  signatureHeader: string
): boolean {
  const expected = `sha256=${sign(body, secret)}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
