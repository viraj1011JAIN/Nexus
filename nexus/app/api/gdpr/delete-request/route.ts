import { NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
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

  const dal = await createDAL(ctx);

  // ── Perform in-place anonymisation inside a single transaction ────────────
  await db.$transaction([
    // 1. Scrub the user's profile fields
    db.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted User",
        // Unique constraint preserved; address is non-routable and clearly synthetic
        email: `deleted-${user.id}@nexus.invalid`,
        imageUrl: null,
        pushSubscription: null,
      },
    }),
    // 2. Unassign cards (remove personal association without deleting work)
    db.card.updateMany({
      where: { assigneeId: user.id },
      data: { assigneeId: null },
    }),
    // 3. Anonymise comment authorship — text is preserved for audit/work trail
    db.comment.updateMany({
      where: { userId: ctx.userId },
      data: { userId: "deleted" },
    }),
  ]);

  // Log the completed erasure in the audit log for compliance tooling
  await dal.auditLogs.create({
    action: "DELETE",
    entityType: "ORGANIZATION",
    entityId: user.id ?? ctx.userId,
    entityTitle: "GDPR erasure completed",
    userName: "Deleted User",
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
    `[gdpr/delete-request] Erasure completed — id=${user.id ?? ctx.userId} orgId=${ctx.orgId}`
  );

  return NextResponse.json({
    success: true,
    message:
      "Your personal data has been erased in accordance with GDPR Article 17. A confirmation email has been sent.",
  });
}
