import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * POST /api/membership-requests
 *
 * Create a board access request. Body: { boardId: string }
 */
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { boardId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { boardId } = body;
  if (!boardId || typeof boardId !== "string") {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify org membership is ACTIVE
  const orgMember = await db.organizationUser.findFirst({
    where: {
      organizationId: orgId,
      userId: user.id,
    },
    select: { status: true },
  });
  if (!orgMember || orgMember.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "You must be an active org member to request board access" },
      { status: 403 }
    );
  }

  // Verify board exists in this org
  const board = await db.board.findFirst({
    where: { id: boardId, orgId },
    select: { id: true },
  });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  // Check if already a member
  const existing = await db.boardMember.findUnique({
    where: {
      boardId_userId: {
        boardId,
        userId: user.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have access to this board" },
      { status: 409 }
    );
  }

  // Check for existing pending request
  const pendingRequest = await db.membershipRequest.findFirst({
    where: {
      userId: user.id,
      boardId,
      orgId,
      type: "BOARD_ACCESS",
      status: "PENDING",
    },
  });
  if (pendingRequest) {
    return NextResponse.json(
      { error: "You already have a pending request for this board" },
      { status: 409 }
    );
  }

  // Create request with 30-day expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const request = await db.membershipRequest.create({
    data: {
      userId: user.id,
      boardId,
      orgId,
      type: "BOARD_ACCESS",
      status: "PENDING",
      expiresAt,
    },
  });

  return NextResponse.json({ id: request.id }, { status: 201 });
}
