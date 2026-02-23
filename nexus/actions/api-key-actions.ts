"use server";

import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import crypto from "crypto";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1, "Select at least one scope"),
  expiresAt: z.string().datetime().optional(),
});

export const API_SCOPES = [
  { value: "boards:read", label: "Boards — Read", description: "List and view boards" },
  { value: "boards:write", label: "Boards — Write", description: "Create and update boards" },
  { value: "cards:read", label: "Cards — Read", description: "List and view cards" },
  { value: "cards:write", label: "Cards — Write", description: "Create, update, delete cards" },
  { value: "members:read", label: "Members — Read", description: "List organization members" },
  { value: "webhooks:write", label: "Webhooks — Write", description: "Manage webhooks" },
];

function hashKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getApiKeys() {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);

    const keys = await db.apiKey.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: keys };
  } catch (e) {
    console.error("[GET_API_KEYS]", e);
    return { error: "Failed to load API keys." };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createApiKey(name: string, scopes: string[], expiresAt?: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = CreateKeySchema.parse({ name, scopes, expiresAt });

    // Generate raw key: nxk_<random>
    const rawKey = `nxk_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.substring(0, 12); // "nxk_XXXXXXX"
    const keyHash = hashKey(rawKey);

    const apiKey = await db.apiKey.create({
      data: {
        orgId: ctx.orgId,
        userId: ctx.userId,
        name: validated.name,
        keyHash,
        keyPrefix,
        scopes: validated.scopes,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
      },
    });

    // Return raw key ONCE — never stored in plaintext
    return {
      data: {
        id: apiKey.id,
        name: apiKey.name,
        rawKey, // ← show once
        keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Validation error." };
    console.error("[CREATE_API_KEY]", e);
    return { error: "Failed to create API key." };
  }
}

export async function revokeApiKey(keyId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.apiKey.findFirst({
      where: { id: keyId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "API key not found." };

    await db.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return { data: true };
  } catch (e) {
    console.error("[REVOKE_API_KEY]", e);
    return { error: "Failed to revoke API key." };
  }
}

export async function deleteApiKey(keyId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("ADMIN", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const existing = await db.apiKey.findFirst({
      where: { id: keyId, orgId: ctx.orgId },
    });
    if (!existing) return { error: "API key not found." };

    await db.apiKey.delete({ where: { id: keyId } });
    return { data: true };
  } catch (e) {
    console.error("[DELETE_API_KEY]", e);
    return { error: "Failed to delete API key." };
  }
}
