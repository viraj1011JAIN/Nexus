import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant-context";

// 100 MB limit
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Allow up to 60 s on Vercel Pro for large file uploads
export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  // Images (SVG intentionally excluded — can embed JS and is an XSS vector
  // when served inline; Supabase Storage CDN does not set Content-Disposition: attachment)
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  // Code / data
  "application/json",
  "application/xml",
  "text/xml",
]);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing");
  // Accept both legacy JWT (eyJ…, ≥100 chars) and new sb_secret_… format keys
  if (!key.startsWith("sb_secret_") && key.length < 100) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a placeholder (too short). " +
      "Copy the service_role key from Supabase Dashboard → Settings → API."
    );
  }
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

  // Explicit null guard: if org row is missing, log a warning and proceed without
  // enforcing limits (fail-open is preferable to blocking legitimate uploads).
  if (!org) {
    console.warn(`[upload] Org ${ctx.orgId} not found when checking subscription plan — skipping limit enforcement`);
  } else if (org.subscriptionPlan === "FREE") {
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

  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (cfgErr) {
    const msg = cfgErr instanceof Error ? cfgErr.message : "Supabase configuration error";
    console.error("[UPLOAD] Configuration error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const storagePath = `attachments/${cardId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("card-attachments")
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[UPLOAD] Supabase storage error:", uploadError.message, "| status:", (uploadError as { statusCode?: string }).statusCode ?? "unknown");
    const msg = uploadError.message?.toLowerCase() ?? "";
    if (msg.includes("invalid api key") || msg.includes("unauthorized")) {
      console.error("[UPLOAD] ⚠ SUPABASE_SERVICE_ROLE_KEY is invalid or missing — check .env.local");
    } else if (msg.includes("bucket") && msg.includes("not found")) {
      console.error("[UPLOAD] ⚠ Bucket 'card-attachments' does not exist — run: npx tsx scripts/setup-storage.ts");
    }
    return NextResponse.json({ error: "File upload failed. Please try again." }, { status: 500 });
  }

  const { data: publicData } = supabase.storage
    .from("card-attachments")
    .getPublicUrl(storagePath);

  const attachment = await (async () => {
    // Wrap attachment count-check + create in a serializable transaction to
    // prevent a TOCTOU race where concurrent uploads breach the FREE plan limit.
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await db.$transaction(
          async (tx) => {
            // Re-check the attachment limit inside the transaction when on FREE plan.
            if (org && org.subscriptionPlan === "FREE") {
              const count = await tx.attachment.count({
                where: { card: { list: { board: { orgId: ctx.orgId } } } },
              });
              if (count >= FREE_ATTACHMENT_LIMIT) {
                throw Object.assign(new Error("ATTACHMENT_LIMIT_REACHED"), { status: 403 });
              }
            }
            return tx.attachment.create({
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
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (e) {
        const prismaErr = e as { code?: string; status?: number; message?: string };
        if (prismaErr.message === "ATTACHMENT_LIMIT_REACHED") {
          return NextResponse.json(
            { error: `Free plan allows a maximum of ${FREE_ATTACHMENT_LIMIT} attachments per workspace. Upgrade to Pro to add more.` },
            { status: 403 }
          ) as unknown as never;
        }
        // P2034 = transaction conflict / serialization failure — retry up to MAX_RETRIES.
        if (prismaErr.code === "P2034" && attempt < MAX_RETRIES - 1) continue;
        throw e;
      }
    }
    throw new Error("Unreachable");
  })();

  // Handle the 403 short-circuit returned from inside the transaction.
  if (attachment instanceof NextResponse) return attachment;

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
