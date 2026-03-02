"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { requireBoardPermission } from "@/lib/board-permissions";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

export async function deleteCard(id: string, _boardId: string) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const rl = checkRateLimit(ctx.userId, "delete-card", RATE_LIMITS["delete-card"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    throw new Error("Cannot modify demo data");
  }

  // Capture card title before deletion for the audit log fallback and event payload.
  // Include the list relation so we can use the DB-verified boardId instead of
  // trusting the caller-supplied parameter (prevents SSRF cache-invalidation abuse).
  const card = await db.card.findUnique({
    where: { id, list: { board: { orgId: ctx.orgId } } },
    include: {
      list: { select: { boardId: true } },
      // Capture storage paths BEFORE the cascade delete removes attachment rows.
      // The Prisma `onDelete: Cascade` on Attachment ensures DB rows are cleaned
      // up automatically, but the actual files in Supabase Storage are NOT touched
      // by the cascade — they must be removed explicitly to prevent orphan files
      // accumulating against the Supabase Storage quota.
      attachments: { select: { storagePath: true } },
    },
  });
  if (!card) {
    throw new Error(`Card ${id} not found or access denied.`);
  }
  const cardTitle = card.title;
  // Require that the list relation was fetched: without it the DB-verified boardId is
  // unavailable and we refuse to fall back to the untrusted caller-supplied parameter.
  if (!card.list) {
    throw new Error(`Card ${id} is missing its list association — cannot resolve a trusted boardId.`);
  }
  const trustedBoardId = card.list.boardId;
  const storagePaths = card.attachments.map((a) => a.storagePath);

  // RBAC: require CARD_DELETE permission on the board (not the untrusted _boardId param)
  await requireBoardPermission(ctx, trustedBoardId, "CARD_DELETE");

  // dal.cards.delete verifies Card→List→Board→orgId === ctx.orgId before deleting
  await dal.cards.delete(id);

  // Write audit log BEFORE emitting the event so that any consumer that processes
  // CARD_DELETED will always find a corresponding audit entry.
  await dal.auditLogs.create({
    entityId: id,
    entityType: "CARD",
    entityTitle: cardTitle,
    action: "DELETE",
  });

  // Fire CARD_DELETED event for automations + webhooks (TASK-019).
  // Wrapped in after() so the serverless runtime keeps the function alive until
  // delivery completes, and the event is guaranteed to fire after the audit write.
  after(async () => {
    // ── Event bus ────────────────────────────────────────────────────────────
    await emitCardEvent(
      { type: "CARD_DELETED", orgId: ctx.orgId, boardId: trustedBoardId, cardId: id },
      { cardId: id, cardTitle, boardId: trustedBoardId, orgId: ctx.orgId },
    );

    // ── Supabase Storage cleanup ──────────────────────────────────────────────
    // The Prisma cascade already removed the Attachment DB rows. Now remove the
    // actual files from Supabase Storage so orphaned blobs don't accumulate
    // against the storage quota. This is best-effort: a failure here is not
    // fatal — a separate retention job can clean up any remaining orphans.
    if (storagePaths.length > 0) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          const storageClient = createSupabaseServiceClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
          });
          await storageClient.storage
            .from("card-attachments")
            .remove(storagePaths);
        }
      } catch {
        // Storage cleanup failure is non-fatal — the card and its DB rows are
        // already deleted. Orphaned files are cleaned up by the weekly cron.
      }
    }
  });

  revalidatePath(`/board/${trustedBoardId}`);
}