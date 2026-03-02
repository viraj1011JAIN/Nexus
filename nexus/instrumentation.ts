/**
 * Next.js Instrumentation — Server Startup Hook
 *
 * WHY THIS EXISTS
 * ---------------
 * Vercel Serverless Functions (and Edge Functions) experience a "cold start"
 * on their first invocation after a deployment or after a period of inactivity.
 * For Prisma, the cold start includes:
 *   1. Node.js module resolution
 *   2. Prisma Client initialisation (query engine binary)
 *   3. Opening the first TCP connection to PostgreSQL / pgBouncer
 *
 * Combined, steps 1–3 can add 1–3 seconds to the first user request.
 *
 * This file uses Next.js 15's instrumentation hook (`register()`) to run a
 * lightweight no-op SQL query (`SELECT 1`) against the database the moment the
 * serverless function container starts up — before any user HTTP traffic hits it.
 * This pre-warms the Prisma connection pool so that the first real user query
 * finds an already-open connection.
 *
 * HOW TO ENABLE IN NEXT.JS
 * ------------------------
 * Ensure `experimental.instrumentationHook: true` is set in `next.config.ts`
 * (it is already set in this project). This file must live at the root of the
 * `app/` or project directory (i.e. alongside `next.config.ts`).
 *
 * PERFORMANCE IMPACT
 * ------------------
 * The `SELECT 1` ping is lightweight (<1 ms) and only runs once per cold start.
 * It has no impact on hot-path performance.
 *
 * PGBOUNCER NOTE
 * --------------
 * The standard `DATABASE_URL` should point to pgBouncer (port 6543, transaction
 * pooling mode) for all app queries. Never use `DIRECT_URL` (port 5432) in
 * production server actions — direct connections exhaust the PostgreSQL connection
 * limit quickly under load. Prisma Migrate and schema introspection are the only
 * operations that need a direct connection.
 */

export async function register() {
  // Only run the warm-up in the Node.js runtime (not Edge).
  // Edge functions have their own warm-up characteristics.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip during tests to avoid interfering with Prisma mocks.
  if (process.env.NODE_ENV === "test") return;

  try {
    // Dynamic import keeps Prisma out of Edge bundles.
    const { db } = await import("@/lib/db");

    // Lightweight ping — opens and validates the database connection.
    // Using $queryRaw instead of $queryRawUnsafe for type safety.
    await db.$queryRaw`SELECT 1`;
  } catch {
    // Warm-up failure is non-fatal — the app still serves requests,
    // just with the usual cold-start latency on the first hit.
    // Errors are intentionally not logged here to avoid noise in traces.
  }
}
