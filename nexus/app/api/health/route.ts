import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Never cache — health checks must always reflect the live state
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Returns the application's health status, database connectivity, and build
 * metadata. Designed to be consumed by load-balancers, uptime monitors, and
 * the internal dashboard.
 *
 * Response codes:
 *   200 – all checks passed ("ok")
 *   503 – one or more checks failed ("degraded")
 */
export async function GET() {
  const startMs = Date.now();

  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    const DB_TIMEOUT_MS = 5_000;
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB health-check timed out")), DB_TIMEOUT_MS)
      ),
    ]);
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "error";
    dbLatencyMs = Date.now() - startMs;
    dbError = "Database unreachable";
    // Log only the error name/message — never the full error object (may contain DSN/credentials).
    const errName = (err instanceof Error ? err.name : "UnknownError");
    const errMsg = (err instanceof Error ? err.message : String(err)).slice(0, 120);
    console.error(`[health] DB connectivity check failed: ${errName} — ${errMsg}`);
  }

  const overall = dbStatus === "ok" ? "ok" : "degraded";
  const httpStatus = overall === "ok" ? 200 : 503;

  const body = {
    status: overall,
    version: process.env.npm_package_version ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : null,
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
    },
  };

  return NextResponse.json(body, { status: httpStatus });
}
