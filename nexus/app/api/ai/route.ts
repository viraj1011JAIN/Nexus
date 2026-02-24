/**
 * TASK-022 — AI Actions API Route
 *
 * POST /api/ai
 * Body: { action: "suggest-priority" | "generate-description" | "suggest-checklist", ...params }
 *
 * Delegates to actions/ai-actions.ts server actions.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@clerk/nextjs/server";
import { suggestPriority, generateCardDescription, suggestChecklists } from "@/actions/ai-actions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.discriminatedUnion("action", [
  z.object({
    action:      z.literal("suggest-priority"),
    title:       z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
  }),
  z.object({
    action:  z.literal("generate-description"),
    title:   z.string().min(1).max(255),
    context: z.string().max(500).optional(),
  }),
  z.object({
    action:      z.literal("suggest-checklist"),
    title:       z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI features not configured." }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  switch (parsed.data.action) {
    case "suggest-priority": {
      const result = await suggestPriority({ title: parsed.data.title, description: parsed.data.description });
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result.data);
    }
    case "generate-description": {
      const result = await generateCardDescription({ title: parsed.data.title, context: parsed.data.context });
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result.data);
    }
    case "suggest-checklist": {
      const result = await suggestChecklists({ title: parsed.data.title, description: parsed.data.description });
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result.data);
    }
  }
}
