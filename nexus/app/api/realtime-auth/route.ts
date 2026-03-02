/**
 * GET /api/realtime-auth?boardId=<id>&channel=<name>
 *
 * Pre-flight membership check for Supabase Realtime subscriptions.
 *
 * Client hooks (use-presence, use-card-lock, use-realtime-board) call this
 * endpoint BEFORE subscribing to any Supabase channel.  It verifies that:
 *
 *   1. The caller has a valid Clerk session (authenticated).
 *   2. The caller is an active member of the organization encoded in the JWT.
 *   3. The caller has a BoardMember row for the requested boardId.
 *
 * Without this check, a user who loses board access (removed by an admin) could
 * still subscribe to presence / change events for that board — because the
 * Supabase client uses a Clerk JWT that only encodes org-level claims, not
 * board-level membership.  This endpoint closes that gap by checking the live
 * DB state each time a subscription is established.
 *
 * Returns:
 *   200 { allowed: true }   — caller may subscribe
 *   403 { allowed: false }  — caller must NOT subscribe
 *   401 { allowed: false }  — unauthenticated
 *   400 { allowed: false }  — missing boardId param
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");

  if (!boardId) {
    return NextResponse.json({ allowed: false, reason: "boardId required" }, { status: 400 });
  }

  try {
    // Resolve internal User.id from Clerk userId (same pattern as getTenantContext)
    const internalUser = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!internalUser) {
      return NextResponse.json({ allowed: false }, { status: 403 });
    }

    // Gate 1 — organisation membership (matches what getTenantContext does)
    // OrganizationUser uses organizationId (= Clerk org id) and userId (internal UUID)
    const orgUser = await db.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: internalUser.id,
        isActive: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!orgUser) {
      return NextResponse.json({ allowed: false }, { status: 403 });
    }

    // Gate 2 — board membership
    const boardMember = await db.boardMember.findFirst({
      where: {
        boardId,
        orgId,
        userId: internalUser.id,
      },
      select: { id: true, role: true },
    });

    if (!boardMember) {
      return NextResponse.json({ allowed: false }, { status: 403 });
    }

    return NextResponse.json({ allowed: true, role: boardMember.role });
  } catch (err) {
    // DB error — fail closed: don't allow subscription when we can't verify
    console.error("[realtime-auth] DB error during board membership check:", err);
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
