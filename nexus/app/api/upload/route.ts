import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant-context";

// 10 MB limit
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Archives
  "application/zip",
]);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** POST /api/upload — multipart/form-data with `file` and `cardId` fields */
export async function POST(req: NextRequest) {
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const cardId = formData.get("cardId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof cardId !== "string" || !cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  // Verify card exists and belongs to the caller's org
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (card.list.board.orgId !== ctx.orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // TASK-008: Enforce plan-based attachment limits
  // FREE plan: max 10 attachments per org across all boards
  const FREE_ATTACHMENT_LIMIT = 10;
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { subscriptionPlan: true },
  });
  if (org?.subscriptionPlan === "FREE") {
    const attachmentCount = await db.attachment.count({
      where: { card: { list: { board: { orgId: ctx.orgId } } } },
    });
    if (attachmentCount >= FREE_ATTACHMENT_LIMIT) {
      return NextResponse.json(
        {
          error: `Free plan allows a maximum of ${FREE_ATTACHMENT_LIMIT} attachments per workspace. Upgrade to Pro to add more.`,
        },
        { status: 403 }
      );
    }
  }

  // Fetch the uploader's display name — user is guaranteed to exist since
  // getTenantContext() provisions the User row on first access.
  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { name: true },
  });
  const uploaderName = user?.name ?? "Unknown";

  const supabase = getServiceClient();
  const storagePath = `attachments/${cardId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("card-attachments")
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[UPLOAD] Supabase storage error:", uploadError.message);
    return NextResponse.json({ error: "File upload failed. Please try again." }, { status: 500 });
  }

  const { data: publicData } = supabase.storage
    .from("card-attachments")
    .getPublicUrl(storagePath);

  const attachment = await db.attachment.create({
    data: {
      cardId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      url: publicData.publicUrl,
      storagePath,
      uploadedById: ctx.userId,
      uploadedByName: uploaderName,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}

/** DELETE /api/upload?id=<attachmentId> */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Only the uploader can delete their own attachments
  if (attachment.uploadedById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServiceClient();

  // Delete DB record first, then remove from storage
  // (if storage remove fails the DB record is already gone — safer than leaving orphaned DB rows)
  await db.attachment.delete({ where: { id } });
  try {
    const { error: storageErr } = await supabase.storage
      .from("card-attachments")
      .remove([attachment.storagePath]);
    if (storageErr) {
      console.error(
        `[upload] Storage removal failed for attachment ${attachment.id} (path: ${attachment.storagePath}):`,
        storageErr
      );
    }
  } catch (unexpectedErr) {
    console.error(
      `[upload] Unexpected error removing attachment ${attachment.id} (path: ${attachment.storagePath}):`,
      unexpectedErr
    );
    // DB record is already deleted; log the orphaned file but return success to the client
  }

  return NextResponse.json({ success: true });
}
