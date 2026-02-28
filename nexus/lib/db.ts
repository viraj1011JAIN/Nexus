import 'server-only';
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
  var systemPrisma: PrismaClient | undefined;
}

// Re-export Prisma type for withTenantTransaction callers
export type { PrismaClient };

/**
 * Standard database client — used by all server actions and API routes.
 * Row-Level Security is enforced by PostgreSQL when this client executes queries
 * through the unprivileged application role (DATABASE_URL should use the app role,
 * not the Supabase service role). For full RLS, ensure DATABASE_URL is set to the
 * restricted role. See prisma/migrations/rls_policies.sql.
 */
export const db = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;

/**
 * System database client — bypasses RLS.
 *
 * ONLY use this for:
 *   1. Stripe webhook handlers (app/api/webhook/stripe/route.ts)
 *   2. Cron jobs (app/api/cron/*)
 *
 * Never import this in server actions or user-triggered API routes.
 * It uses the service-role connection string (SYSTEM_DATABASE_URL) which
 * has superuser privileges and bypasses all Row-Level Security policies.
 */
export const systemDb =
  globalThis.systemPrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.SYSTEM_DATABASE_URL ?? process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalThis.systemPrisma = systemDb;

/**
 * Sets the PostgreSQL session variables for RLS policies:
 *   - `app.current_org_id` → read by `current_org_id()` in RLS
 *   - `app.current_user_id` → read by `current_user_id()` in RLS (board isolation)
 *
 * POOLING NOTE — two modes, different behaviour:
 *   - Session-mode pooling (Supabase DIRECT_URL, port 5432):
 *     SET persists for the entire connection lifetime. Reliable for all queries.
 *   - Transaction-mode pooling (Supabase DATABASE_URL, port 6543 / PgBouncer):
 *     SET is connection-scoped but connections are reassigned per transaction,
 *     so the variable may be absent on the next query. Use withTenantTransaction()
 *     instead for guaranteed enforcement in transaction-mode pools.
 */
export async function setCurrentOrgId(orgId: string, userId: string = ''): Promise<void> {
  await db.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, false)`;
  if (userId) {
    await db.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, false)`;
  }
}

/**
 * Wraps `fn` in an explicit Prisma transaction that sets both `app.current_org_id`
 * and `app.current_user_id` with `SET LOCAL` (transaction-scoped) BEFORE executing
 * any queries.
 *
 * This is the correct way to activate RLS with transaction-mode connection pooling
 * (PgBouncer at Supabase port 6543), because `SET LOCAL` is guaranteed to be
 * visible to every query within the same BEGIN/COMMIT block, on any pooling mode.
 *
 * Use for all high-value mutations: board delete, member management, billing ops.
 *
 * @param orgId    The organization ID — always required
 * @param fn       The function to execute within the transaction
 * @param userId   The user's internal DB ID — optional for backward compatibility.
 *                 When provided, sets `app.current_user_id` for board-level RLS.
 *
 * @example
 * const board = await withTenantTransaction(ctx.orgId, (tx) =>
 *   tx.board.delete({ where: { id: boardId } })
 * , userId);
 */
export async function withTenantTransaction<T>(
  orgId: string,
  fn: (
    tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
  ) => Promise<T>,
  userId: string = ''
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    if (userId) {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    }
    return fn(tx);
  });
}