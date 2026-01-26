import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json([]);
    }

    const logs = await db.auditLog.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityTitle: log.entityTitle,
      entityType: log.entityType,
      userName: log.user.name,
      userImage: log.user.imageUrl,
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
