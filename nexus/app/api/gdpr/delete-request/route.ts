import { NextResponse } from "next/server";
import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/gdpr/delete-request
 *
 * Submits a data erasure request for the authenticated user.
 * GDPR Article 17 — Right to Erasure ("Right to be Forgotten").
 *
 * In production, this should:
 *   1. Record the request in a dedicated table for audit purposes.
 *   2. Trigger a back-office process / webhook to execute erasure within 30 days.
 *   3. Send a confirmation email to the user.
 *
 * The actual deletion is NOT performed synchronously — it goes through a
 * review / grace-period workflow as recommended by GDPR guidelines.
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

  // Log the erasure request in the audit log so it is discoverable by
  // compliance tooling and cannot be silently dropped.
  await dal.auditLogs.create({
    action: "DELETE",
    entityType: "ORGANIZATION",
    entityId: user.id ?? ctx.userId,
    entityTitle: `GDPR erasure request`,
    userName: user.name ?? undefined,
  });

  // TODO (production): enqueue a deletion job, e.g.:
  //   await queue.enqueue("gdpr.erase", { userId: ctx.userId, orgId: ctx.orgId });
  // and send a confirmation email via your transactional email provider.

  // Log only the non-sensitive user identifier — never log email addresses.
  console.info(
    `[gdpr/delete-request] Erasure requested — id=${user.id ?? ctx.userId} orgId=${ctx.orgId}`
  );

  return NextResponse.json({
    success: true,
    message:
      "Your deletion request has been received and will be processed within 30 days in accordance with GDPR Article 17.",
  });
}
