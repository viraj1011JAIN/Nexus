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

export async function POST(request: NextRequest) {
  // Protect with the same cron secret used for cron jobs
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await seedBuiltInTemplates();
    return NextResponse.json({ success: true, message: "Built-in templates seeded successfully." });
  } catch (error) {
    console.error("[SEED_TEMPLATES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
