import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * GET /api/membership-requests/mine
 *
 * Returns the current user's membership requests (board access + org join).
 * Used by the "Request Board Access" page to show request history/status.
 */
export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ requests: [] });
  }

  const requests = await db.membershipRequest.findMany({
    where: {
      userId: user.id,
      orgId,
    },
    include: {
      board: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      boardId: r.boardId,
      boardTitle: r.board?.title ?? null,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
