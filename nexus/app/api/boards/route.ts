import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTenantContext, TenantError } from "@/lib/tenant-context";

export async function GET() {
  try {
    let orgId: string;
    try {
      const ctx = await getTenantContext();
      orgId = ctx.orgId;
    } catch (e) {
      if (e instanceof TenantError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw e;
    }
    
    const rawBoards = await db.board.findMany({
      where: {
        orgId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        imageThumbUrl: true,
        _count: {
          select: { lists: true },
        },
        lists: {
          select: {
            _count: { select: { cards: true } },
          },
        },
      },
    });

    const boards = rawBoards.map((b) => ({
      id: b.id,
      title: b.title,
      updatedAt: b.updatedAt,
      imageThumbUrl: b.imageThumbUrl,
      listCount: b._count.lists,
      cardCount: b.lists.reduce((sum, l) => sum + l._count.cards, 0),
    }));

    return NextResponse.json(boards);
  } catch (error) {
    logger.error("Failed to fetch boards", { error });
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}
