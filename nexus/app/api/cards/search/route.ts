import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTenantContext, TenantError } from "@/lib/tenant-context";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause for search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      list: {
        board: {
          orgId,
        },
      },
    };

    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    const cards = await db.card.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        listId: true,
        list: {
          select: {
            title: true,
            board: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(cards);
  } catch (error) {
    logger.error("Failed to search cards", { error });
    return NextResponse.json(
      { error: "Failed to search cards" },
      { status: 500 }
    );
  }
}
