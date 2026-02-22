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
