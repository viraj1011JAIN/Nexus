/**
 * AI Actions — actions/ai-actions.ts
 *
 * Thin Server Action orchestrators for AI features:
 *   - suggestPriority        — infer priority from card title + description
 *   - generateCardDescription — expand a short title into a structured description
 *   - suggestChecklists       — generate a to-do checklist for a given card
 *
 * Auth, input validation, and rate limiting live here.
 * Actual prompt engineering and OpenAI calls are in lib/services/ai-service.ts.
 *
 * Rate-limited: 50 calls/org/day tracked in Organization.aiCallsToday
 */

"use server";

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { db }   from "@/lib/db";
import { z }    from "zod";
import {
  runSuggestPriority,
  runGenerateDescription,
  runSuggestChecklists,
} from "@/lib/services/ai-service";

// AI_DAILY_LIMIT is read at call time so process.env overrides in tests are
// picked up without a module reload.
function getAiDailyLimit(): number {
  const parsed = parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Rate limiting (DB-backed) ────────────────────────────────────────────────

async function checkRateLimit(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { aiCallsToday: true, aiCallsResetAt: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const now      = new Date();
  const resetAt  = org.aiCallsResetAt ? new Date(org.aiCallsResetAt) : null;
  // Use UTC midnight to ensure consistent daily resets regardless of server timezone
  const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const needsReset = !resetAt || resetAt < todayUtcMidnight;

  if (needsReset) {
    await db.organization.update({ where: { id: orgId }, data: { aiCallsToday: 0, aiCallsResetAt: now } });
    return { ok: true };
  }

  if (org.aiCallsToday >= getAiDailyLimit()) {
    return { ok: false, error: `Daily AI limit of ${getAiDailyLimit()} calls reached. Resets at midnight.` };
  }

  return { ok: true };
}

async function incrementUsage(orgId: string) {
  await db.organization.update({ where: { id: orgId }, data: { aiCallsToday: { increment: 1 } } });
}

// ─── suggestPriority ──────────────────────────────────────────────────────────

const SuggestPriorityInput = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function suggestPriority(
  input: z.infer<typeof SuggestPriorityInput>,
): Promise<{ data?: { priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"; reasoning: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = SuggestPriorityInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  try {
    const data = await runSuggestPriority(parsed.data.title, parsed.data.description);
    await incrementUsage(orgId);
    return { data };
  } catch (e) {
    console.error("[SUGGEST_PRIORITY]", e);
    return { error: "AI request failed. Please try again." };
  }
}

// ─── generateCardDescription ──────────────────────────────────────────────────

const GenerateDescriptionInput = z.object({
  title:   z.string().min(1).max(255),
  context: z.string().max(500).optional(),
});

export async function generateCardDescription(
  input: z.infer<typeof GenerateDescriptionInput>,
): Promise<{ data?: { description: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = GenerateDescriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  try {
    const data = await runGenerateDescription(parsed.data.title, parsed.data.context);
    await incrementUsage(orgId);
    return { data };
  } catch (e) {
    console.error("[GENERATE_DESCRIPTION]", e);
    return { error: "AI request failed. Please try again." };
  }
}

// ─── suggestChecklists ────────────────────────────────────────────────────────

const SuggestChecklistInput = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function suggestChecklists(
  input: z.infer<typeof SuggestChecklistInput>,
): Promise<{ data?: { items: string[] }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = SuggestChecklistInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  try {
    const data = await runSuggestChecklists(parsed.data.title, parsed.data.description);
    await incrementUsage(orgId);
    return { data };
  } catch (e) {
    console.error("[SUGGEST_CHECKLISTS]", e);
    return { error: "AI request failed. Please try again." };
  }
}
