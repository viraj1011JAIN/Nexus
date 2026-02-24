/**
 * TASK-021 — Public REST API: API Key Authentication Middleware
 *
 * Resolves a Bearer token from the Authorization header, validates SHA-256 hash,
 * checks expiry/revocation, updates lastUsedAt, and returns the orgId + userId.
 *
 * Scopes: boards:read  boards:write  cards:read  cards:write
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export type ApiScope =
  | "boards:read"
  | "boards:write"
  | "cards:read"
  | "cards:write";

export interface ApiKeyContext {
  orgId: string;
  userId: string;
  scopes: string[];
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiKeyContext }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Authenticate a request via `Authorization: Bearer nxk_...`
 * Pass required scope(s); returns 403 if the key lacks them.
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScopes: ApiScope[]
): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(nxk_[A-Za-z0-9]+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Missing or malformed Bearer token." };
  }

  const rawKey = match[1];
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const key = await db.apiKey.findUnique({ where: { keyHash } });
  if (!key) return { ok: false, status: 401, message: "Invalid API key." };
  if (key.revokedAt)   return { ok: false, status: 401, message: "API key has been revoked." };
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { ok: false, status: 401, message: "API key has expired." };
  }

  const missingScopes = requiredScopes.filter((s) => !key.scopes.includes(s));
  if (missingScopes.length > 0) {
    return {
      ok: false,
      status: 403,
      message: `API key is missing required scopes: ${missingScopes.join(", ")}`,
    };
  }

  // Update lastUsedAt (fire-and-forget)
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    ok: true,
    ctx: { orgId: key.orgId, userId: key.userId, scopes: key.scopes },
  };
}

/** Convenience: return a standard JSON error response */
export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
