import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Verify card exists and belongs to a board the user can access
  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { list: { include: { board: true } } },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Verify the uploader is a member of the org that owns this card
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }
  const orgMembership = await db.organizationUser.findFirst({
    where: { userId: user.id, organizationId: card.list.board.orgId, isActive: true },
  });
  if (!orgMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the uploader's User record
  const uploaderName = user.name;

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
      uploadedById: userId,
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
    await supabase.storage.from("card-attachments").remove([attachment.storagePath]);
  } catch (storageErr) {
    console.error(
      `[upload] Storage removal failed for attachment ${attachment.id} (path: ${attachment.storagePath}):`,
      storageErr
    );
    // DB record is already deleted; log the orphaned file but return success to the client
  }

  return NextResponse.json({ success: true });
}
