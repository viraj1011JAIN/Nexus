/**
 * TASK-029 — Push Notification Subscribe
 *
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscriptionJSON }
 *
 * Saves the browser push subscription to the current user's record.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

const SubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth:   z.string(),
    }),
    expirationTime: z.number().nullable().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  await db.user.update({
    where: { id: userId },
    data: { pushSubscription: JSON.stringify(parsed.data.subscription) },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: userId },
    data: { pushSubscription: null },
  });

  return NextResponse.json({ ok: true });
}
