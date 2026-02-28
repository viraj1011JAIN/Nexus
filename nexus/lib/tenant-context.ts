/**
 * Tenant Context — Single Source of Truth for Multi-Tenant Security
 *
 * RULES:
 * - orgId ALWAYS comes from Clerk's signed JWT, never from function parameters or client input
 * - Uses React cache() so the Clerk + DB call executes ONCE per request regardless of how
 *   many actions call getTenantContext()
 * - Throws typed TenantError on any auth/membership failure — never returns null
 *   so callers CANNOT accidentally proceed without checking the result
 */

import 'server-only';
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cache } from "react";
import { DEMO_ORG_ID } from "@/lib/action-protection";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TenantRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export type TenantContext = {
  userId: string;
  orgId: string;
  orgRole: string;
  membership: {
    role: TenantRole;
    isActive: boolean;
  };
};

export type TenantErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

export class TenantError extends Error {
  constructor(
    public readonly code: TenantErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TenantError";
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TenantError.prototype);
  }
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<TenantRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
};

// ─── Core context getter ──────────────────────────────────────────────────────

/**
 * THE canonical way to get tenant context in any server component, server action,
 * or API route handler.
 *
 * cache() ensures this function is called AT MOST ONCE per request.
 * The Clerk auth() call and DB membership query are deduplicated automatically.
 *
 * @throws {TenantError} UNAUTHENTICATED — no userId or orgId in session
 * @throws {TenantError} FORBIDDEN — user not in OrganizationUser table or isActive=false
 */
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    throw new TenantError(
      "UNAUTHENTICATED",
      "No active session or organization context"
    );
  }

  // Step 1: Resolve the User row — we need the internal UUID to query/create
  // OrganizationUser. OrganizationUser.userId is a FK to User.id (UUID), NOT
  // to Clerk's external user string.
  let user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  if (!user) {
    // ── User row healing path ─────────────────────────────────────────────
    // There is no Clerk webhook provisioning User rows — we create the row
    // on first access, gated on the Clerk-signed JWT proving the user exists.
    // This handles first sign-in, local dev (no webhook tunnel), and any
    // missed/delayed webhook delivery in production.
    try {
      const clerkUser = await (await clerkClient()).users.getUser(userId);
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        `${userId}@provisioned.local`;
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        clerkUser.username ||
        "Unknown User";

      user = await db.user.create({
        data: {
          clerkUserId: userId,
          email,
          name,
          imageUrl: clerkUser.imageUrl ?? null,
        },
        select: { id: true },
      });
    } catch {
      // Race condition: concurrent request created the row between our findUnique
      // and create calls. Re-fetch; if still null, re-throw the original error.
      user = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
      if (!user) {
        throw new TenantError(
          "UNAUTHENTICATED",
          "Failed to provision user account — please try again"
        );
      }
    }
  }

  // Step 2: Check the local membership record.
  const membership = await db.organizationUser.findFirst({
    where: { userId: user.id, organizationId: orgId },
    select: { role: true, isActive: true },
  });

  // Step 3: Explicit deactivation — local admin decision overrides Clerk session.
  // isActive=false is the instant-revocation mechanism: an admin sets this, and
  // the next request is rejected regardless of whether the Clerk session is live.
  if (membership?.isActive === false) {
    throw new TenantError(
      "FORBIDDEN",
      "Not an active member of this organization"
    );
  }

  let tenantRole: TenantRole;

  if (membership) {
    // ── Normal path ───────────────────────────────────────────────────────
    // Row exists → use the verified local DB role.
    tenantRole = membership.role as TenantRole;
  } else {
    // ── Healing path ──────────────────────────────────────────────────────
    // No local record. Clerk's signed JWT confirms orgId is valid — the user
    // IS a member of this org according to Clerk. Trust the JWT role provisionally
    // AND immediately create the DB row so isActive revocation works going forward.
    //
    // Without creating the row now, an admin can never set isActive=false
    // because there is no row to update — the instant-revocation guarantee
    // would be permanently broken for this user.
    //
    // SAFETY: row creation is gated on orgId being present in Clerk's signed JWT.
    // Only Clerk-confirmed org members can provision their own OrganizationUser row.
    tenantRole = normalizeClerkRole(orgRole);

    // Only create if the Organization row already exists in our DB.
    // If it doesn't (missed `organization.created` webhook), the first board-create
    // action will auto-create the Organization; getTenantContext will then provision
    // this row successfully on the very next request.
    const orgExists = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (orgExists) {
      await db.organizationUser
        .create({
          data: {
            userId: user.id,
            organizationId: orgId,
            role: tenantRole,
            isActive: true,
            joinedAt: new Date(),
          },
        })
        .catch((err: unknown) => {
          // Only swallow unique-constraint violations — two concurrent requests both
          // tried to create the same row; the second fails safely because the first
          // already created it. Re-throw all other errors (connection failures, etc.)
          const message = err instanceof Error ? err.message : String(err);
          if (!message.toLowerCase().includes("unique constraint")) throw err;
        });
    }
  }

  return {
    userId,
    orgId,
    orgRole: orgRole ?? "",
    membership: {
      role: tenantRole,
      isActive: true,
    },
  };
});

/**
 * Maps a Clerk org role string (e.g. "org:admin") to our internal TenantRole enum.
 * Falls back to MEMBER if the role is unrecognised or absent.
 */
function normalizeClerkRole(clerkRole: string | null | undefined): TenantRole {
  if (!clerkRole) return "MEMBER";
  const lower = clerkRole.toLowerCase();
  if (lower.includes("owner")) return "OWNER";
  if (lower.includes("admin")) return "ADMIN";
  if (lower.includes("guest")) return "GUEST";
  return "MEMBER";
}

// ─── Role enforcement ─────────────────────────────────────────────────────────

/**
 * Requires the calling user to have at least the specified role.
 * Call this at the top of every mutation server action.
 *
 * @param minimumRole  The lowest role allowed to perform this operation
 * @param ctx          Optional pre-fetched context (avoids double auth() call)
 *
 * @throws {TenantError} FORBIDDEN if role is insufficient
 *
 * @example
 * const ctx = await getTenantContext();
 * await requireRole("MEMBER", ctx);   // blocks GUESTs
 * await requireRole("ADMIN", ctx);    // blocks MEMBERs and GUESTs
 */
export async function requireRole(
  minimumRole: TenantRole,
  ctx?: TenantContext
): Promise<TenantContext> {
  const context = ctx ?? (await getTenantContext());

  if (ROLE_HIERARCHY[context.membership.role] < ROLE_HIERARCHY[minimumRole]) {
    throw new TenantError(
      "FORBIDDEN",
      `Requires ${minimumRole} role or higher`
    );
  }

  return context;
}

// ─── Demo mode guard ──────────────────────────────────────────────────────────

/**
 * Returns true if the current org context is the demo org.
 * Use this to block mutations in the demo workspace.
 * orgId always comes from ctx, never from caller parameters.
 */
export function isDemoContext(ctx: TenantContext): boolean {
  return ctx.orgId === DEMO_ORG_ID;
}
