import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { db } from "@/lib/db";

/**
 * GET /api/attachment?cardId=<id>
 *
 * Returns all attachments for the specified card. Requires the caller to belong
 * to the same org as the card's board (IDOR protection).
 *
 * Response: { attachments: AttachmentDto[] }
 */
export async function GET(req: NextRequest) {
  let ctx: Awaited<ReturnType<typeof getTenantContext>>;
  try {
    ctx = await getTenantContext();
  } catch (err) {
    if (err instanceof TenantError) {
      const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }

  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  // IDOR protection: verify the card belongs to the caller's org before
  // returning any attachment metadata.
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: { select: { orgId: true } } } } },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (card.list.board.orgId !== ctx.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachments = await db.attachment.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      url: true,
      uploadedByName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ attachments });
}
