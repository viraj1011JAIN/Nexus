/**
 * TASK-022 — AI Features
 *
 * Server actions that wrap OpenAI:
 *   - suggestPriority        — infer priority from card title + description
 *   - generateCardDescription — expand a short title into a structured description
 *   - suggestChecklists       — generate a to-do checklist for a given card
 *
 * Requires: OPENAI_API_KEY env var  (npm install openai)
 * Rate-limited: 20 calls/org/day tracked in Organization.aiCallsToday
 */

"use server";

import { auth }  from "@clerk/nextjs/server";
import { db }    from "@/lib/db";
import OpenAI    from "openai";
import { z }     from "zod";

const _rawKey = process.env.OPENAI_API_KEY ?? "";
const _keyValid = Boolean(_rawKey) && !_rawKey.includes("REPLACE") && _rawKey.length >= 20;

if (!_keyValid) {
  console.warn(
    "[ai-actions] ⚠  OPENAI_API_KEY is missing or is still the placeholder value.\n" +
    "            AI features are disabled. Add your real key to .env.local:  OPENAI_API_KEY=sk-..."
  );
}

// Null when key is missing/invalid — callers must check via getOpenAI() before calling the API.
const openai: OpenAI | null = _keyValid ? new OpenAI({ apiKey: _rawKey }) : null;

/** Returns the OpenAI client or throws a descriptive error if not configured. */
function getOpenAI(): OpenAI {
  if (!openai) {
    throw new Error("AI features are disabled: OPENAI_API_KEY is missing or invalid. Set it in .env.local.");
  }
  return openai;
}

const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 50);
const AI_MODEL       = process.env.AI_MODEL ?? "gpt-4o-mini";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkRateLimit(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { aiCallsToday: true, aiCallsResetAt: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };

  const now = new Date();
  const resetAt = org.aiCallsResetAt ? new Date(org.aiCallsResetAt) : null;
  const needsReset = !resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (needsReset) {
    await db.organization.update({
      where: { id: orgId },
      data: { aiCallsToday: 0, aiCallsResetAt: now },
    });
    return { ok: true };
  }

  if (org.aiCallsToday >= AI_DAILY_LIMIT) {
    return { ok: false, error: `Daily AI limit of ${AI_DAILY_LIMIT} calls reached. Resets at midnight.` };
  }

  return { ok: true };
}

async function incrementUsage(orgId: string) {
  await db.organization.update({
    where: { id: orgId },
    data: { aiCallsToday: { increment: 1 } },
  });
}

// ─── suggestPriority ──────────────────────────────────────────────────────────

const SuggestPriorityInput = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function suggestPriority(
  input: z.infer<typeof SuggestPriorityInput>
): Promise<{ data?: { priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"; reasoning: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = SuggestPriorityInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  const prompt = `You are a project management assistant. Given the following task, suggest the most appropriate priority level.

Task title: ${parsed.data.title}
${parsed.data.description ? `Description: ${parsed.data.description}` : ""}

Respond with ONLY valid JSON: { "priority": "URGENT"|"HIGH"|"MEDIUM"|"LOW", "reasoning": "<1-2 sentences>" }`;

  const completion = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 150,
    temperature: 0.3,
  });

  await incrementUsage(orgId);

  const content = completion.choices[0]?.message?.content ?? "{}";
  const result  = JSON.parse(content) as { priority: string; reasoning: string };

  const validPriorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  const priority = validPriorities.includes(result.priority as (typeof validPriorities)[number])
    ? (result.priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW")
    : "MEDIUM";

  return { data: { priority, reasoning: result.reasoning ?? "" } };
}

// ─── generateCardDescription ──────────────────────────────────────────────────

const GenerateDescriptionInput = z.object({
  title:   z.string().min(1).max(255),
  context: z.string().max(500).optional(),
});

export async function generateCardDescription(
  input: z.infer<typeof GenerateDescriptionInput>
): Promise<{ data?: { description: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = GenerateDescriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  const prompt = `You are a project management assistant. Write a clear, concise task description for the following card.

Card title: ${parsed.data.title}
${parsed.data.context ? `Context: ${parsed.data.context}` : ""}

Write 2-4 sentences describing what needs to be done, acceptance criteria, and any relevant technical notes.
Keep the tone professional and action-oriented. Do NOT use markdown headers — plain prose only.`;

  const completion = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.5,
  });

  await incrementUsage(orgId);

  const description = completion.choices[0]?.message?.content?.trim() ?? "";
  return { data: { description } };
}

// ─── suggestChecklists ────────────────────────────────────────────────────────

const SuggestChecklistInput = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function suggestChecklists(
  input: z.infer<typeof SuggestChecklistInput>
): Promise<{ data?: { items: string[] }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const parsed = SuggestChecklistInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = await checkRateLimit(orgId);
  if (!rate.ok) return { error: rate.error };

  const prompt = `You are a project management assistant. Generate a practical checklist for the following task.

Task: ${parsed.data.title}
${parsed.data.description ? `Description: ${parsed.data.description}` : ""}

Respond with ONLY valid JSON: { "items": ["<checklist item>", ...] }
Provide 4-8 actionable items. Each item should be a short imperative sentence (e.g., "Write unit tests for the auth module").`;

  const completion = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 400,
    temperature: 0.4,
  });

  await incrementUsage(orgId);

  const content = completion.choices[0]?.message?.content ?? "{}";
  const result  = JSON.parse(content) as { items?: unknown };
  const items   = Array.isArray(result.items)
    ? (result.items as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 8)
    : [];

  return { data: { items } };
}
