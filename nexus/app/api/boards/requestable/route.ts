import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * GET /api/boards/requestable
 *
 * Returns boards the current user does NOT have access to,
 * plus whether they already have a pending request.
 *
 * Used by the "Request Board Access" page.
 */
export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve internal user id
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ boards: [] });
  }

  // Boards user is NOT a member of
  const boards = await db.board.findMany({
    where: {
      orgId,
      members: {
        none: { userId: user.id },
      },
    },
    select: {
      id: true,
      title: true,
      isPrivate: true,
      _count: { select: { members: true } },
    },
    orderBy: { title: "asc" },
  });

  // Check pending requests
  const pendingRequests = await db.membershipRequest.findMany({
    where: {
      userId: user.id,
      orgId,
      type: "BOARD_ACCESS",
      status: "PENDING",
    },
    select: { boardId: true },
  });
  const pendingBoardIds = new Set(pendingRequests.map((r) => r.boardId));

  return NextResponse.json({
    boards: boards.map((b) => ({
      id: b.id,
      title: b.title,
      isPrivate: b.isPrivate,
      memberCount: b._count.members,
      hasPendingRequest: pendingBoardIds.has(b.id),
    })),
  });
}
