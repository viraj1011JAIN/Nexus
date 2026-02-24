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
import dns from "dns";
import net from "node:net";
import https from "node:https";
import http from "node:http";
import { db } from "@/lib/db";

// ─── SSRF protection ─────────────────────────────────────────────────────────

// Hostnames that must never be contacted (regardless of what the stored URL says)
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
]);

// IPv4 CIDR ranges considered private / link-local / loopback
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||                           // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) ||  // 172.16.0.0/12
    (a === 192 && b === 168) ||            // 192.168.0.0/16
    a === 127 ||                           // 127.0.0.0/8  loopback
    (a === 169 && b === 254) ||            // 169.254.0.0/16  link-local / AWS metadata
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10  RFC 6598 shared address space
    a === 0                               // 0.0.0.0/8
  );
}

// IPv6 addresses considered private / loopback / link-local / ULA
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  // Bare unspecified address
  if (lower === "::") return true;
  // Loopback
  if (lower === "::1") return true;
  // IPv4-mapped addresses (::ffff:x.x.x.x or ::ffff:0:x.x.x.x) — delegate to IPv4 check
  const v4mapped = lower.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);

  // 6to4 addresses (2002::/16) — the next two hextets encode an IPv4 address.
  // Format: 2002:WWXX:YYZZ:: where WW.XX.YY.ZZ is the embedded IPv4 address.
  const sixToFour = lower.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/);
  if (sixToFour) {
    const h1 = sixToFour[1].padStart(4, "0");
    const h2 = sixToFour[2].padStart(4, "0");
    const embeddedIp = [
      parseInt(h1.slice(0, 2), 16),
      parseInt(h1.slice(2, 4), 16),
      parseInt(h2.slice(0, 2), 16),
      parseInt(h2.slice(2, 4), 16),
    ].join(".");
    if (isPrivateIPv4(embeddedIp)) return true;
  }

  // ULA (Unique Local Addresses): fc00::/7 — covers fc00::/8 and fd00::/8
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

  // Link-local: fe80::/10 — first byte 0xfe, second byte in 0x80–0xbf
  // (the simple "fe80:" prefix check misses fe81:: through febf:: which are also link-local)
  const lowerHexBytes = lower.split(":")[0].padStart(4, "0");
  if (lowerHexBytes.length >= 4) {
    const byte1 = parseInt(lowerHexBytes.slice(0, 2), 16);
    const byte2 = parseInt(lowerHexBytes.slice(2, 4), 16);
    if (byte1 === 0xfe && byte2 >= 0x80 && byte2 <= 0xbf) return true;
  }

  return false;
}

/**
 * Validate a webhook target URL before delivery.
 *
 * Returns `{ valid: true; resolvedIp: string }` if the URL is safe to call,
 * exposing the resolved IP so callers can pin it to prevent TOCTOU DNS rebinding.
 * Returns `{ valid: false; reason: string }` explaining why it was blocked.
 */
async function validateWebhookUrl(
  url: string
): Promise<{ valid: true; resolvedIp: string } | { valid: false; reason: string }> {
  // 1. Parse
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: `Malformed URL: ${url}` };
  }

  // 2. Protocol — require https in production
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `Protocol '${parsed.protocol}' not allowed in production (must be https)`,
    };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Known-blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Also block bare IPs that are obviously private without DNS lookup
  if (isPrivateIPv4(hostname)) {
    return { valid: false, reason: `Blocked private IPv4 address: ${hostname}` };
  }
  if (isPrivateIPv6(hostname)) {
    return { valid: false, reason: `Blocked private IPv6 address: ${hostname}` };
  }

  // 4. DNS resolution — reject if hostname resolves to any private range
  try {
    const [v4Results, v6Results] = await Promise.allSettled([
      dns.promises.resolve4(hostname),
      dns.promises.resolve6(hostname),
    ]);

    const ipv4s = v4Results.status === "fulfilled" ? v4Results.value : [];
    const ipv6s = v6Results.status === "fulfilled" ? v6Results.value : [];

    for (const ip of ipv4s) {
      if (isPrivateIPv4(ip)) {
        return {
          valid: false,
          reason: `Hostname '${hostname}' resolves to private IPv4 ${ip}`,
        };
      }
    }
    for (const ip of ipv6s) {
      if (isPrivateIPv6(ip)) {
        return {
          valid: false,
          reason: `Hostname '${hostname}' resolves to private IPv6 ${ip}`,
        };
      }
    }

    // Require at least one resolved address (paranoid: avoids ephemeral DNS tricks)
    if (ipv4s.length === 0 && ipv6s.length === 0) {
      return { valid: false, reason: `Hostname '${hostname}' did not resolve` };
    }

    // Return the first usable resolved IP so callers can pin it for the actual request
    // (prevents TOCTOU DNS rebinding between validation and fetch).
    const resolvedIp = ipv4s[0] ?? ipv6s[0];
    return { valid: true, resolvedIp };
  } catch (dnsErr) {
    return {
      valid: false,
      reason: `DNS lookup failed for '${hostname}': ${String(dnsErr)}`,
    };
  }
}

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

  // ── SSRF guard ─────────────────────────────────────────────────────────────
  const urlCheck = await validateWebhookUrl(webhook.url);
  if (!urlCheck.valid) {
    console.warn(
      `[WebhookDelivery] Blocked delivery to webhook ${webhook.id} — ${urlCheck.reason}`
    );
    // Record blocked attempt as a failed delivery so the user sees it in the log
    const duration = Date.now() - startMs;
    try {
      await db.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as object,
          statusCode: null,
          success: false,
          duration,
        },
      });
    } catch (dbErr) {
      console.error("[WebhookDelivery] Failed to save blocked-delivery record:", dbErr);
    }
    return;
  }

  // Build the request: for both HTTP and HTTPS we pin the resolved IP to prevent
  // TOCTOU DNS rebinding between validateWebhookUrl and the actual connection.
  // For HTTPS, an Agent with a custom lookup override connects to the pinned IP
  // while Node.js still uses the original hostname for TLS SNI / cert validation.
  const originalParsed = new URL(webhook.url);
  const isHttps = originalParsed.protocol === "https:";
  const pinnedFamily: 4 | 6 = urlCheck.resolvedIp.includes(":") ? 6 : 4;
  // Both HTTP and HTTPS use a pinned lookup to prevent TOCTOU DNS rebinding.
  // For HTTPS the Agent still uses originalParsed.hostname for TLS SNI / cert validation.
  // Typed as net.LookupFunction so it is compatible with both https.Agent and
  // http.Agent without narrowing. The family parameter is widened to number
  // (net.LookupFunction contract) even though pinnedFamily is always 4 or 6.
  const pinnedLookup: net.LookupFunction = (
    _host: string,
    _opts,
    cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) => cb(null, urlCheck.resolvedIp, pinnedFamily);
  const agent = isHttps
    ? new https.Agent({ lookup: pinnedLookup, keepAlive: false })
    : new http.Agent({ lookup: pinnedLookup, keepAlive: false });

  // ── 3-attempt exponential backoff retry ─────────────────────────────────
  // Retry on: network errors, timeouts, and HTTP 5xx responses.
  // Do NOT retry on HTTP 4xx (client error — retrying won't help).
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const sig = sign(body, webhook.secret);

      const controller = new AbortController();
      const abortTimeout = setTimeout(() => controller.abort(), 10_000); // 10 s timeout

      try {
        await new Promise<void>((resolve, reject) => {
          const proto = isHttps ? https : http;
          const reqOptions = {
            hostname: originalParsed.hostname, // used for TLS SNI / cert validation
            port: Number(originalParsed.port) || (isHttps ? 443 : 80),
            path: (originalParsed.pathname || "/") + originalParsed.search,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Nexus-Webhook/1.0",
              "Host": originalParsed.host,
              "X-Nexus-Event": event,
              "X-Nexus-Signature-256": `sha256=${sig}`,
              "X-Nexus-Delivery": crypto.randomUUID(),
              "Content-Length": String(Buffer.byteLength(body)),
            },
            agent,
          };

          const req = proto.request(reqOptions, (res) => {
            statusCode = res.statusCode ?? null;
            success = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
            // Drain body to release the underlying socket
            res.resume();
            res.on("end", resolve);
            res.on("error", reject);
          });

          req.on("error", reject);
          controller.signal.addEventListener("abort", () => {
            req.destroy(new Error("Request timeout"));
            reject(new Error("Request timeout"));
          });

          req.write(body);
          req.end();
        });
      } finally {
        clearTimeout(abortTimeout);
      }

      // 2xx → done. 4xx → don't retry (permanent client error).
      if (success || (statusCode !== null && statusCode < 500)) break;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS - 1) {
        // All attempts exhausted — record as failure
        success = false;
        console.warn(
          `[WebhookDelivery] Delivery failed for webhook ${webhook.id} after ${MAX_ATTEMPTS} attempt(s):`,
          err
        );
        break;
      }
    }

    // Exponential backoff before next attempt: 1 s, 2 s
    const delayMs = 1_000 * (2 ** attempt);
    console.info(
      `[WebhookDelivery] Retrying webhook ${webhook.id} in ${delayMs}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`
    );
    await new Promise<void>((r) => setTimeout(r, delayMs));
  }

  const duration = Date.now() - startMs;

  try {
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as object,
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
