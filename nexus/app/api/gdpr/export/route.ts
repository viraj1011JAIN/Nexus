import { NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/gdpr/export
 *
 * Compiles a portable JSON archive of all personal data held for the
 * requesting user and streams it as a download.
 *
 * GDPR Article 20 — Right to Data Portability.
 */
export async function POST() {
  let ctx: Awaited<ReturnType<typeof getTenantContext>>;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "UNAUTHENTICATED" ? 401 : 403 });
    }
    throw err;
  }

  // Fetch the DB user record
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch boards in the current org the user has interacted with
  const [cards, comments, auditLogs, attachments] = await Promise.all([
    db.card.findMany({
      where: { assigneeId: user.id, list: { board: { orgId: ctx.orgId } } },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        list: { select: { title: true, board: { select: { title: true } } } },
      },
    }),
    db.comment.findMany({
      where: { userId: ctx.userId, card: { list: { board: { orgId: ctx.orgId } } } },
      select: {
        id: true,
        text: true,
        createdAt: true,
        card: { select: { id: true, title: true } },
      },
    }),
    db.auditLog.findMany({
      where: { userId: ctx.userId, orgId: ctx.orgId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityTitle: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.attachment.findMany({
      where: { uploadedById: ctx.userId, card: { list: { board: { orgId: ctx.orgId } } } },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        url: true,
        createdAt: true,
      },
    }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    dataSubject: {
      profile: user,
    },
    data: {
      assignedCards: cards,
      comments,
      auditLogs,
      attachments,
    },
    note: "This export contains your personal data as defined under GDPR Article 20. For questions contact privacy@nexus.app.",
  };

  const json = JSON.stringify(exportPayload, null, 2);
  const bytes = Buffer.from(json, "utf-8");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nexus-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Content-Length": String(bytes.length),
    },
  });
}
