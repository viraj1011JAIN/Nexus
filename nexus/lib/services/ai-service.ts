/**
 * AI Service — lib/services/ai-service.ts
 *
 * Owns all OpenAI client management, prompt engineering, and model calls.
 * Server Actions in actions/ai-actions.ts delegate here after handling auth,
 * input validation, and rate limiting — keeping those files under 200 lines.
 *
 * Why dynamic import?
 * The `openai` package contains Node.js-specific top-level code that Turbopack
 * evaluates when building the client-side Server Action proxy, causing:
 *   "module factory is not available. It might have been deleted in an HMR update."
 * A dynamic import is invisible to the static module graph so it is only
 * resolved at runtime on the server where Node.js is available.
 */

import "server-only";

import type OpenAI from "openai";

const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// ── OpenAI singleton ──────────────────────────────────────────────────────────

let _openai: OpenAI | null | undefined; // undefined = uninitialised

async function getOpenAI(): Promise<OpenAI> {
  if (_openai === undefined) {
    const rawKey   = process.env.OPENAI_API_KEY ?? "";
    const keyValid = Boolean(rawKey) && !rawKey.includes("REPLACE") && rawKey.length >= 20;

    if (!keyValid) {
      console.warn(
        "[ai-service] ⚠  OPENAI_API_KEY is missing or still a placeholder.\n" +
        "             AI features are disabled. Add your real key to .env.local: OPENAI_API_KEY=sk-..."
      );
      _openai = null;
    } else {
      const { default: OpenAIClass } = await import("openai");
      _openai = new OpenAIClass({ apiKey: rawKey });
    }
  }

  if (!_openai) {
    throw new Error(
      "AI features are disabled: OPENAI_API_KEY is missing or invalid. Set it in .env.local."
    );
  }

  return _openai;
}

// ── Prompt-injection sanitiser ────────────────────────────────────────────────
//
// User content is placed in the `user` role message, separate from `system`
// instructions — OpenAI's recommended mitigation against prompt injection.
// sanitizeForPrompt() provides an extra defence layer:
//   • Strips ASCII/Unicode control characters that can inject hidden text.
//   • Collapses excessive whitespace (multi-line "jailbreak" padding).
//   • Hard-caps each field to the Zod-validated length limit.
//
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Public service functions ──────────────────────────────────────────────────

export async function runSuggestPriority(
  title: string,
  description?: string,
): Promise<{ priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW"; reasoning: string }> {
  const safeTitle       = sanitizeForPrompt(title);
  const safeDescription = description ? sanitizeForPrompt(description) : undefined;

  const completion = await (await getOpenAI()).chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a project management assistant. Given a task, suggest the most appropriate priority level. " +
          'Respond with ONLY valid JSON: { "priority": "URGENT"|"HIGH"|"MEDIUM"|"LOW", "reasoning": "<1-2 sentences>" }',
      },
      {
        role: "user",
        content: `Task title: ${safeTitle}${safeDescription ? `\nDescription: ${safeDescription}` : ""}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 150,
    temperature: 0.3,
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const result  = JSON.parse(content) as { priority: string; reasoning: string };

  const validPriorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  const priority = validPriorities.includes(result.priority as (typeof validPriorities)[number])
    ? (result.priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW")
    : "MEDIUM";

  return { priority, reasoning: result.reasoning ?? "" };
}

export async function runGenerateDescription(
  title: string,
  context?: string,
): Promise<{ description: string }> {
  const safeTitle   = sanitizeForPrompt(title);
  const safeContext = context ? sanitizeForPrompt(context) : undefined;

  const completion = await (await getOpenAI()).chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a project management assistant. Write a clear, concise task description " +
          "for the given card title. Write 2-4 sentences describing what needs to be done, " +
          "acceptance criteria, and relevant technical notes. Keep the tone professional and " +
          "action-oriented. Do NOT use markdown headers \u2014 plain prose only.",
      },
      {
        role: "user",
        content: `Card title: ${safeTitle}${safeContext ? `\nContext: ${safeContext}` : ""}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.5,
  });

  const description = completion.choices[0]?.message?.content?.trim() ?? "";
  return { description };
}

export async function runSuggestChecklists(
  title: string,
  description?: string,
): Promise<{ items: string[] }> {
  const safeTitle       = sanitizeForPrompt(title);
  const safeDescription = description ? sanitizeForPrompt(description) : undefined;

  const completion = await (await getOpenAI()).chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a project management assistant. Generate a practical checklist for the given task. " +
          'Respond with ONLY valid JSON: { "items": ["<checklist item>", ...] } ' +
          "Provide 4-8 actionable items. Each item should be a short imperative sentence " +
          '(e.g., "Write unit tests for the auth module").',
      },
      {
        role: "user",
        content: `Task: ${safeTitle}${safeDescription ? `\nDescription: ${safeDescription}` : ""}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const result  = JSON.parse(content) as { items?: unknown };
  const items   = Array.isArray(result.items)
    ? (result.items as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 8)
    : [];

  return { items };
}
