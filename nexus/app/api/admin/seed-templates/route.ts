/**
 * Admin: Seed Built-In Templates
 *
 * POST /api/admin/seed-templates
 *
 * Idempotent — only creates templates that don't already exist.
 * Protected by CRON_SECRET (same secret as cron jobs) so it can be
 * called from a CI/CD pipeline or one-off curl command after deploy.
 *
 * Usage:
 *   curl -X POST https://your-domain.com/api/admin/seed-templates \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { seedBuiltInTemplates } from "@/actions/template-actions";
import { verifyCronSecret } from "@/lib/verify-cron-secret";

export async function POST(request: NextRequest) {
  // Guard: CRON_SECRET must be configured
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[SEED_TEMPLATES] CRON_SECRET env var is not set");
    return new NextResponse("Service Unavailable", { status: 503 });
  }

  // Protect with the same cron secret used for cron jobs (timing-safe)
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await seedBuiltInTemplates(cronSecret);
    return NextResponse.json({ success: true, message: "Built-in templates seeded successfully." });
  } catch (error) {
    console.error("[SEED_TEMPLATES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
