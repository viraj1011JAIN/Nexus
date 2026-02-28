/**
 * Request Context — IP Address & User Agent Extraction
 *
 * Extracts client metadata from the incoming request for audit logging.
 * Safe for Server Components, Server Actions, and API Routes.
 *
 * IMPORTANT: headers() can fail if called outside a request context
 * (e.g. during static generation or in a non-request code path).
 * All callers get a safe fallback — never throws.
 */

import 'server-only';
import { headers } from "next/headers";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Extract the client IP and User-Agent from the current request.
 *
 * Returns safe defaults if headers() is not available (e.g. static generation).
 * NEVER throws — callers can always spread the result into audit log data.
 *
 * IP resolution priority:
 *   1. x-forwarded-for (Vercel, Cloudflare, standard load balancers)
 *   2. x-real-ip (nginx, some reverse proxies)
 *   3. cf-connecting-ip (Cloudflare)
 *   4. null (unknown)
 *
 * The leftmost IP in x-forwarded-for is the client IP (before any proxies).
 */
export async function getRequestContext(): Promise<RequestContext> {
  try {
    const h = await headers();

    // IP address resolution — use the first (leftmost) IP from x-forwarded-for
    const forwardedFor = h.get("x-forwarded-for");
    const ipAddress =
      (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip") ||
      null;

    // User agent
    const userAgent = h.get("user-agent") || null;

    return { ipAddress, userAgent };
  } catch {
    // headers() throws when called outside a request context (static generation,
    // build-time rendering, etc.). Return safe defaults.
    return { ipAddress: null, userAgent: null };
  }
}
