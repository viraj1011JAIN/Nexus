import { db } from "@/lib/db";
import { NextResponse } from "next/server";
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

    const logs = await db.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityTitle: log.entityTitle,
      entityType: log.entityType,
      userName: log.userName,
      userImage: log.userImage,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    logger.error("Failed to fetch audit logs", { error });
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
