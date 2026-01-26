import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Return empty array if no organization selected
    if (!orgId) {
      return NextResponse.json([]);
    }
    
    const boards = await db.board.findMany({
      where: {
        orgId,
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
    logger.error("Failed to fetch boards", { error });
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}
