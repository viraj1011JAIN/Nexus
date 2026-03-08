import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Timing-safe comparison of the Authorization: Bearer <token> header
 * against the CRON_SECRET env var.
 *
 * Prevents secret enumeration via response-time side-channel attacks.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    // Lengths differ — timingSafeEqual throws if buffers differ in size
    return false;
  }
}
