import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const boards = await db.board.findMany({
      where: {
        orgId: "default-organization",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
      },
    });

    return NextResponse.json(boards);
  } catch (error) {
    console.error("[API_BOARDS_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}
