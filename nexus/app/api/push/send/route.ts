/**
 * TASK-029 — Push Notification Send
 *
 * POST /api/push/send
 * Body: { userId?: string; orgId?: string; title: string; body: string; url?: string }
 *
 * Sends a Web Push notification to one user or all users in an org.
 * Uses the `web-push` package (npm install web-push).
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY   – generate with: npx web-push generate-vapid-keys
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      – e.g. "mailto:you@example.com"
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import webpush from "web-push";

// Lazy VAPID initializer — deferred to request time so that a missing/empty
// key during `next build` (static page-data collection) does not crash the
// process.  Throws a descriptive error instead of propagating the raw
// web-push crypto error when the env vars are absent at runtime.
function initVapid() {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? "mailto:admin@nexus.app";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set. " +
      "Generate them with: npx web-push generate-vapid-keys"
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

const SendSchema = z.object({
  userId: z.string().optional(),   // send to one specific user
  title:  z.string().min(1).max(128),
  body:   z.string().min(1).max(512),
  url:    z.string().optional(),
  tag:    z.string().optional(),
});

export async function POST(req: NextRequest) {
  try { initVapid(); } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const { userId: callerId, orgId } = await auth();
  if (!callerId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { userId: targetUserId, title, body: notifBody, url = "/", tag } = parsed.data;

  // Fetch target subscriptions
  const users = await db.user.findMany({
    where: {
      ...(targetUserId ? { id: targetUserId } : {}),
      pushSubscription: { not: null },
    },
    select: { id: true, pushSubscription: true },
  });

  const payload = JSON.stringify({ title, body: notifBody, url, tag });
  const results = await Promise.allSettled(
    users.map(async (u) => {
      if (!u.pushSubscription) return;
      const sub = JSON.parse(u.pushSubscription) as webpush.PushSubscription;
      await webpush.sendNotification(sub, payload);
    })
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}

// ─── Public VAPID key endpoint (needed by the client to subscribe) ──────────

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!key) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
