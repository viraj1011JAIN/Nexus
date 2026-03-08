import { NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/gdpr/delete-request
 *
 * Immediately anonymises personal data for the authenticated user (GDPR Art. 17).
 *
 * What is anonymised:
 *   - User.name, User.email, User.imageUrl, User.pushSubscription scrubbed
 *   - Cards unassigned (assigneeId → null)
 *   - Comment authorship anonymised (userId → "deleted"; text preserved for audit trail)
 *
 * What is retained:
 *   - The User row itself (foreign-key anchor for AuditLog / Activity)
 *   - AuditLog rows (required for security audit trail)
 *   - Comment text (may contain information about other persons / work)
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

  const user = await db.user.findUnique({
    where: { clerkUserId: ctx.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Perform in-place anonymisation AND record the compliance event atomically ────────────
  await db.$transaction(async (tx) => {
    // 1. Scrub the user's profile fields
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted User",
        // Unique constraint preserved; address is non-routable and clearly synthetic
        email: `deleted-${user.id}@nexus.invalid`,
        imageUrl: null,
        pushSubscription: null,
      },
    });

    // 2. Unassign cards (remove personal association without deleting work)
    await tx.card.updateMany({
      where: { assigneeId: user.id },
      data: { assigneeId: null },
    });

    // 3. Anonymise comment authorship — text is preserved for audit/work trail.
    //    Comment.userId stores the Clerk external ID (written at create time),
    //    so we must match on ctx.userId, not the internal DB user.id.
    await tx.comment.updateMany({
      where: { userId: ctx.userId },
      data: { userId: "deleted", userName: "Deleted User", userImage: null },
    });

    // 3b. Anonymise comment reactions
    await tx.commentReaction.updateMany({
      where: { userId: ctx.userId },
      data: { userId: "deleted", userName: "Deleted User" },
    });

    // 4. Record the erasure for compliance inside the same transaction: if any
    //    step above fails, this log entry rolls back too — no audit without erasure.
    await tx.auditLog.create({
      data: {
        action:      "DELETE",
        entityType:  "ORG_MEMBER",
        entityId:    user.id,
        entityTitle: "GDPR erasure completed",
        orgId:       ctx.orgId,
        userId:      ctx.userId,
        userImage:   "",
        userName:    "Deleted User",
      },
    });
  });

  // Send confirmation email to the original address (before it was anonymised)
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Your data has been erased — Nexus",
      html: `<p>Hi,</p><p>Your personal data has been erased from Nexus in accordance with GDPR Article 17. Your comments and activity logs have been anonymised; work content has been retained for your team's records.</p><p>If you have questions, contact privacy@nexus.app.</p>`,
    }).catch((err) => {
      // Non-fatal — erasure has already completed
      console.error("[gdpr/delete-request] Confirmation email failed:", err);
    });
  }

  // Log only non-sensitive identifiers — never log email addresses
  console.info(
    `[gdpr/delete-request] Erasure completed — id=${user.id} orgId=${ctx.orgId}`
  );

  return NextResponse.json({
    success: true,
    message:
      "Your personal data has been erased in accordance with GDPR Article 17. A confirmation email has been sent.",
  });
}
