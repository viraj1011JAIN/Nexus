/**
 * TASK-027 — Integrations Hub: Slack Handler
 *
 * POST /api/integrations/slack
 *
 * Supports:
 *   1. Slack slash command: /nexus <query>  — searches cards and returns a message
 *   2. Incoming webhook verification (challenge)
 *
 * Env vars:
 *   SLACK_SIGNING_SECRET   — verify Slack request signatures
 *   SLACK_BOT_TOKEN        — for sending messages back (optional if using response_url)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db }  from "@/lib/db";

export const dynamic = "force-dynamic";

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  slackSig: string
): boolean {
  const FIVE_MINUTES = 5 * 60;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > FIVE_MINUTES) return false;
  const baseString = `v0:${timestamp}:${body}`;
  const myHash     = `v0=${crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(myHash), Buffer.from(slackSig));
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  // ── URL-encoded slash command ──────────────────────────────────────────────
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const secret    = process.env.SLACK_SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Slack integration not configured" }, { status: 503 });
    }
    const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
    const slackSig  = req.headers.get("x-slack-signature") ?? "";

    if (!verifySlackSignature(secret, timestamp, rawBody, slackSig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const params  = new URLSearchParams(rawBody);
    const command = params.get("command");
    const text    = (params.get("text") ?? "").trim();
    const teamId  = params.get("team_id") ?? "";

    // Look up which Nexus org is linked to this Slack workspace.
    // For now, verify the orgId exists in our DB to prevent data leakage.
    const org = await db.organization.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "This Slack workspace is not linked to a Nexus organization.",
      });
    }
    const orgId = org.id;

    if (command === "/nexus") {
      if (!text) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Usage: `/nexus <search query>` — search your Nexus cards.",
        });
      }

      const cards = await db.card.findMany({
        where: {
          list: { board: { orgId } },
          OR: [
            { title: { contains: text, mode: "insensitive" } },
            { description: { contains: text, mode: "insensitive" } },
          ],
        },
        take: 5,
        select: {
          id: true, title: true, priority: true,
          list: { select: { title: true, board: { select: { id: true, title: true } } } },
        },
      });

      if (cards.length === 0) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `No cards found matching *${text}*.`,
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.app";
      const blocks = [
        { type: "section", text: { type: "mrkdwn", text: `*Search results for "${text}":*` } },
        ...cards.map((c) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *<${appUrl}/board/${c.list.board.id}|${c.title}>*\n  _${c.list.board.title} › ${c.list.title}_ · ${c.priority}`,
          },
        })),
      ];

      return NextResponse.json({ response_type: "in_channel", blocks });
    }

    return NextResponse.json({ response_type: "ephemeral", text: "Unknown command." });
  }

  // ── JSON event (URL verification or event API) ─────────────────────────────
  if (contentType.includes("application/json")) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Slack URL verification challenge
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    return NextResponse.json({ ok: true });
  }

  return new NextResponse("Unsupported content type", { status: 415 });
}
