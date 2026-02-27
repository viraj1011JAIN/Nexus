/**
 * Section 1 — Authentication & Session Tests
 *
 * Covers every scenario documented in the spec plus production-level edge cases:
 *
 *   1.1  Middleware Redirects (proxy.ts / clerkMiddleware)
 *   1.2  getTenantContext() — Auto-Provisioning & DB healing paths
 *   1.3  Expired / Invalid Sessions — TenantError codes & client-safe messages
 *   1.4  Demo Mode — isDemoContext(), mutation blocking, error message hygiene
 *   1.5  requireRole() — Role hierarchy & FORBIDDEN enforcement
 *   1.6  normalizeClerkRole() — JWT role string → TenantRole (tested via healing path)
 *
 * Mocking strategy
 * ────────────────
 *  • `react.cache` → identity function (prevents cross-test memoization)
 *  • `@clerk/nextjs/server` → partial mock exposing inner auth fn for middleware tests
 *  • `@/lib/tenant-context` → partial mock (real isDemoContext/requireRole/TenantError,
 *    mock getTenantContext so Section 1.4 action tests can inject a demo ctx, while
 *    Sections 1.2/1.3 restore the real implementation to test the DB healing paths)
 *  • `@/lib/db` → full mock covering every table the auth layer touches
 *  • `next/server` → NextResponse.next / .redirect stubs returning plain objects
 *  • Supporting mocks (dal, cache, action-protection, stripe, logger, template-actions)
 */

// ─── HOISTED MOCKS (must be declared before any imports) ──────────────────────

// Prevent React's cache() from memoising results across tests.
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// ---------------------------------------------------------------------------
// @clerk/nextjs/server
//
// The middleware test needs to call the inner async handler with a controlled
// auth function. We expose `_mockInnerAuth` on the fake module so tests can
// reconfigure what `await auth()` returns inside proxy.ts without importing
// the Clerk object directly.
// ---------------------------------------------------------------------------
jest.mock("@clerk/nextjs/server", () => {
  const _mockInnerAuth = jest.fn();
  return {
    // Exposed so tests can call: (clerkNextMock as any)._mockInnerAuth.mockResolvedValue(...)
    _mockInnerAuth,

    // Used directly by getTenantContext (not by the middleware handler)
    auth: jest.fn(),
    clerkClient: jest.fn(),

    // clerkMiddleware captures the handler and returns a thin wrapper that calls it
    // with the injectable `_mockInnerAuth` as the auth accessor.
    clerkMiddleware: jest.fn(
      (handler: (authFn: unknown, req: unknown) => unknown) =>
        (req: unknown) =>
          handler(_mockInnerAuth, req)
    ),

    // Real-ish route matcher: handles exact paths and prefix patterns like "/sign-in(.*)"
    createRouteMatcher: jest.fn((patterns: string[]) => (req: { nextUrl: { pathname: string } }) => {
      const { pathname } = req.nextUrl;
      return patterns.some((p) => {
        if (p === "/") return pathname === "/";
        const base = p.replace("(.*)", "");
        return pathname === base || pathname.startsWith(base + "/");
      });
    }),
  };
});

// ---------------------------------------------------------------------------
// next/server  — NextResponse stubs
// ---------------------------------------------------------------------------
jest.mock("next/server", () => ({
  NextResponse: {
    next: jest.fn((init?: { request?: { headers?: Headers } }) => ({
      _type: "next",
      _headers: init?.request?.headers,
    })),
    redirect: jest.fn((url: URL | string) => ({
      _type: "redirect",
      _url: url instanceof URL ? url.toString() : url,
    })),
  },
}));

// ---------------------------------------------------------------------------
// @/lib/db — every table accessed by the auth layer + create-board action
// ---------------------------------------------------------------------------
jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
  setCurrentOrgId: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// @/lib/tenant-context — partial mock
// Real exports: TenantError, isDemoContext, requireRole, ROLE_HIERARCHY
// Mocked: getTenantContext (injectable per test)
// ---------------------------------------------------------------------------
jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  );
  return {
    ...actual,
    getTenantContext: jest.fn(),
  };
});

// Supporting mocks for create-board action tests (Section 1.4)
jest.mock("@/lib/dal", () => ({
  createDAL: jest.fn().mockResolvedValue({
    boards: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    auditLogs: { create: jest.fn() },
  }),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/action-protection", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetInMs: 60_000 }),
  RATE_LIMITS: { "create-board": 10 },
}));

jest.mock("@/lib/stripe", () => ({
  STRIPE_CONFIG: {
    limits: {
      FREE: { boards: 50, cardsPerBoard: 500 },
      PRO: { boards: Infinity, cardsPerBoard: Infinity },
    },
  },
  stripe: {},
  isStripeConfigured: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("@/actions/template-actions", () => ({
  createBoardFromTemplate: jest.fn(),
}));

// ─── REAL IMPORTS (after all mock declarations) ────────────────────────────

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, setCurrentOrgId } from "@/lib/db";
import {
  getTenantContext,
  TenantError,
  isDemoContext,
  requireRole,
  ROLE_HIERARCHY,
  type TenantContext,
  type TenantRole,
} from "@/lib/tenant-context";
import { createBoard } from "@/actions/create-board";

// Import the middleware AFTER all mocks are set up so the module uses our stubs
import middleware from "@/proxy";

// ─── Typed mock helpers ────────────────────────────────────────────────────

const mockGetTenantContext    = getTenantContext as jest.Mock;
const mockAuth                = auth             as unknown as jest.Mock;
const mockClerkClient         = clerkClient      as jest.Mock;
const mockNextResponseNext    = NextResponse.next    as jest.Mock;
const mockNextResponseRedirect = NextResponse.redirect as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInnerAuth: jest.Mock = (jest.requireMock("@clerk/nextjs/server") as any)._mockInnerAuth;

// Typed DB mock accessors
const mockUserFindUnique       = db.user.findUnique         as jest.Mock;
const mockUserCreate           = db.user.create             as jest.Mock;
const mockOrgFindUnique        = db.organization.findUnique as jest.Mock;
const mockOrgUserFindFirst     = db.organizationUser.findFirst as jest.Mock;
const mockOrgUserCreate        = db.organizationUser.create as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────

const USER_ID   = "user_clerk_abc123";
const ORG_ID    = "org_clerk_def456";
const ORG_ROLE  = "org:member";
const DB_USER   = { id: "uuid-internal-user-1" };
const DEMO_ORG  = "demo-org-id";

const AUTHED_CTX: TenantContext = {
  userId: USER_ID,
  orgId: ORG_ID,
  orgRole: ORG_ROLE,
  membership: { role: "MEMBER", isActive: true },
};

const DEMO_CTX: TenantContext = {
  userId: USER_ID,
  orgId: DEMO_ORG,
  orgRole: "org:member",
  membership: { role: "MEMBER", isActive: true },
};

/** Create a minimal NextRequest-compatible mock object for middleware testing */
function makeReq(pathname: string, search = ""): Record<string, unknown> {
  const url = `http://localhost${pathname}${search}`;
  return {
    url,
    nextUrl: { pathname, search },
    headers: new Headers(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.1 — Middleware Redirects
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.1 — Middleware Redirects (proxy.ts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Unauthenticated (no userId) ──────────────────────────────────────────

  it("should redirect to /sign-in when user is not signed in", async () => {
    mockInnerAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    expect(mockNextResponseRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl: string = mockNextResponseRedirect.mock.calls[0][0].toString();
    expect(redirectUrl).toContain("/sign-in");
  });

  it("should preserve original pathname in redirect_url query param", async () => {
    mockInnerAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    const redirectUrl = new URL(mockNextResponseRedirect.mock.calls[0][0].toString());
    expect(redirectUrl.searchParams.get("redirect_url")).toBe("/dashboard");
  });

  it("should include search params in redirect_url", async () => {
    mockInnerAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await middleware(makeReq("/board/board-1", "?filter=mine") as never, undefined as never);

    const redirectUrl = new URL(mockNextResponseRedirect.mock.calls[0][0].toString());
    expect(redirectUrl.searchParams.get("redirect_url")).toBe("/board/board-1?filter=mine");
  });

  it("should redirect nested protected routes to /sign-in when unauthenticated", async () => {
    mockInnerAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await middleware(makeReq("/settings/automations") as never, undefined as never);

    const redirectUrl: string = mockNextResponseRedirect.mock.calls[0][0].toString();
    expect(redirectUrl).toContain("/sign-in");
  });

  // ── Authenticated but no org ─────────────────────────────────────────────

  it("should redirect to /select-org when signed in but no active org", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: null, orgRole: null });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    expect(mockNextResponseRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl: string = mockNextResponseRedirect.mock.calls[0][0].toString();
    expect(redirectUrl).toContain("/select-org");
  });

  it("should NOT redirect when visiting /select-org without an org (avoids redirect loop)", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: null, orgRole: null });

    await middleware(makeReq("/select-org") as never, undefined as never);

    // Should call .next() not .redirect()
    expect(mockNextResponseRedirect).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalledTimes(1);
  });

  it("should NOT redirect to /select-org for /select-org/* sub-paths", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: null, orgRole: null });

    await middleware(makeReq("/select-org/create") as never, undefined as never);

    expect(mockNextResponseRedirect).not.toHaveBeenCalled();
  });

  // ── Fully authenticated ──────────────────────────────────────────────────

  it("should call NextResponse.next() when user has session and active org", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    expect(mockNextResponseNext).toHaveBeenCalledTimes(1);
    expect(mockNextResponseRedirect).not.toHaveBeenCalled();
  });

  it("should inject x-tenant-id header equal to orgId", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    const callArgs = mockNextResponseNext.mock.calls[0][0];
    const headers: Headers = callArgs?.request?.headers;
    expect(headers.get("x-tenant-id")).toBe(ORG_ID);
  });

  it("should inject x-user-id header equal to userId", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    const headers: Headers = mockNextResponseNext.mock.calls[0][0]?.request?.headers;
    expect(headers.get("x-user-id")).toBe(USER_ID);
  });

  it("should inject x-org-role header equal to orgRole", async () => {
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });

    await middleware(makeReq("/dashboard") as never, undefined as never);

    const headers: Headers = mockNextResponseNext.mock.calls[0][0]?.request?.headers;
    expect(headers.get("x-org-role")).toBe(ORG_ROLE);
  });

  it("should NOT set x-tenant-id or x-org-role headers when orgId/orgRole are null", async () => {
    // Authenticated user visiting /select-org — orgId is null, loop prevention fires
    mockInnerAuth.mockResolvedValue({ userId: USER_ID, orgId: null, orgRole: null });

    await middleware(makeReq("/select-org") as never, undefined as never);

    const headers: Headers = mockNextResponseNext.mock.calls[0]?.[0]?.request?.headers;
    expect(headers?.get("x-tenant-id")).toBeNull();
    expect(headers?.get("x-org-role")).toBeNull();
  });

  // ── Public routes bypass auth entirely ───────────────────────────────────

  it.each([
    ["/", "root"],
    ["/sign-in", "/sign-in"],
    ["/sign-in/sso-callback", "/sign-in/*"],
    ["/sign-up", "/sign-up"],
    ["/sign-up/continue", "/sign-up/*"],
    ["/api/webhook/stripe", "/api/webhook/stripe"],
    ["/api/webhook/stripe/connect", "/api/webhook/stripe/*"],
  ])("should pass through public route %s without checking auth", async (pathname) => {
    // auth is NOT called for public routes — the matcher returns true before auth check
    await middleware(makeReq(pathname) as never, undefined as never);

    // For public routes, the middleware returns NextResponse.next() immediately
    // The inner auth mock should NOT have been called
    expect(mockInnerAuth).not.toHaveBeenCalled();
    expect(mockNextResponseNext).toHaveBeenCalledTimes(1);
    expect(mockNextResponseRedirect).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.2 — getTenantContext() Auto-Provisioning
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.2 — getTenantContext() Auto-Provisioning", () => {
  /**
   * For this section the REAL getTenantContext implementation runs.
   * We restore the real function and control its dependencies (auth, clerkClient, db).
   */
  const realImpl = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  ).getTenantContext;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore real implementation for direct integration tests
    mockGetTenantContext.mockImplementation(realImpl);
  });

  // Shared auth/membership setup helper ─────────────────────────────────────
  function setupHappyPath() {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });
  }

  // ── New-user provisioning ────────────────────────────────────────────────

  it("should create a new User row when clerkUserId is not in DB", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    // No existing user row
    mockUserFindUnique.mockResolvedValueOnce(null);
    // clerkClient().users.getUser returns Clerk user data
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [{ id: "email-1", emailAddress: "alice@example.com" }],
          primaryEmailAddressId: "email-1",
          firstName: "Alice",
          lastName: "Smith",
          username: null,
          imageUrl: "https://img.clerk.com/alice.jpg",
        }),
      },
    });
    mockUserCreate.mockResolvedValue({ id: "new-uuid" });
    // After creation, second findUnique not needed (create returned the user)
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });

    const ctx = await getTenantContext();

    expect(mockClerkClient).toHaveBeenCalledTimes(1);
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkUserId: USER_ID,
          email: "alice@example.com",
          name: "Alice Smith",
          imageUrl: "https://img.clerk.com/alice.jpg",
        }),
        select: { id: true },
      })
    );
    expect(ctx.userId).toBe(USER_ID);
  });

  it("should NOT call clerkClient for an already-provisioned user", async () => {
    setupHappyPath();

    await getTenantContext();

    expect(mockClerkClient).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("should fall back to username as display name when first/last name are absent", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [{ id: "e1", emailAddress: "bob@example.com" }],
          primaryEmailAddressId: "e1",
          firstName: null,
          lastName: null,
          username: "bob_the_builder",
          imageUrl: null,
        }),
      },
    });
    mockUserCreate.mockResolvedValue({ id: "bob-uuid" });
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });

    await getTenantContext();

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "bob_the_builder" }),
      })
    );
  });

  it("should fall back to {userId}@provisioned.local when no email addresses exist", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    mockUserFindUnique.mockResolvedValueOnce(null);
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [],
          primaryEmailAddressId: null,
          firstName: null,
          lastName: null,
          username: null,
          imageUrl: null,
        }),
      },
    });
    mockUserCreate.mockResolvedValue({ id: "fallback-uuid" });
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });

    await getTenantContext();

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: `${USER_ID}@provisioned.local`,
        }),
      })
    );
  });

  // ── OrganizationUser healing path ────────────────────────────────────────

  it("should provision an OrganizationUser row when membership is missing from DB", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: "org:admin" });
    mockUserFindUnique.mockResolvedValue(DB_USER);
    // No existing membership
    mockOrgUserFindFirst.mockResolvedValue(null);
    // Org exists
    mockOrgFindUnique.mockResolvedValue({ id: ORG_ID });
    mockOrgUserCreate.mockResolvedValue({});

    const ctx = await getTenantContext();

    expect(mockOrgUserCreate).toHaveBeenCalledTimes(1);
    expect(mockOrgUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: DB_USER.id,
          organizationId: ORG_ID,
          role: "ADMIN", // normalizeClerkRole("org:admin") → "ADMIN"
          isActive: true,
        }),
      })
    );
    expect(ctx.membership.role).toBe("ADMIN");
  });

  it("should NOT create OrganizationUser row when org does not exist in DB yet", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: "org:member" });
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgUserFindFirst.mockResolvedValue(null);
    // Org does NOT exist
    mockOrgFindUnique.mockResolvedValue(null);

    // Should not throw — just returns without creating the row
    const ctx = await getTenantContext();

    expect(mockOrgUserCreate).not.toHaveBeenCalled();
    expect(ctx.membership.role).toBe("MEMBER");
  });

  it("should recover from race condition on user.create (unique constraint violation)", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    mockUserFindUnique
      .mockResolvedValueOnce(null)          // First findUnique: no row
      .mockResolvedValueOnce(DB_USER);      // Re-fetch after failed create: row exists
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [{ id: "e", emailAddress: "x@y.com" }],
          primaryEmailAddressId: "e",
          firstName: "X",
          lastName: "Y",
          username: null,
          imageUrl: null,
        }),
      },
    });
    // user.create throws unique constraint violation (race condition)
    mockUserCreate.mockRejectedValue(new Error("Unique constraint failed on the fields: (`clerkUserId`)"));
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });

    // Should NOT throw — healing path re-fetches successfully
    const ctx = await getTenantContext();

    expect(ctx.userId).toBe(USER_ID);
    expect(mockUserFindUnique).toHaveBeenCalledTimes(2); // initial + re-fetch
  });

  it("should throw TenantError UNAUTHENTICATED when race condition re-fetch also fails", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    // Both findUnique attempts return null
    mockUserFindUnique.mockResolvedValue(null);
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: jest.fn().mockResolvedValue({
          emailAddresses: [{ id: "e", emailAddress: "x@y.com" }],
          primaryEmailAddressId: "e",
          firstName: "X",
          lastName: null,
          username: null,
          imageUrl: null,
        }),
      },
    });
    mockUserCreate.mockRejectedValue(new Error("Unique constraint failed"));

    await expect(getTenantContext()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("should return a properly shaped TenantContext on the happy path", async () => {
    setupHappyPath();

    const ctx = await getTenantContext();

    expect(ctx).toMatchObject({
      userId: USER_ID,
      orgId: ORG_ID,
      orgRole: ORG_ROLE,
      membership: { role: "MEMBER", isActive: true },
    });
  });

  it("should return deterministic results on repeated calls (cache-worthy contract)", async () => {
    setupHappyPath();
    // Second call uses same mocked values since we configure them before both calls
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: true });

    const ctx1 = await getTenantContext();
    const ctx2 = await getTenantContext();

    // Content must be identical — this is what React cache() would deduplicate in prod
    expect(ctx1).toMatchObject(ctx2);
    expect(ctx1.userId).toBe(ctx2.userId);
    expect(ctx1.orgId).toBe(ctx2.orgId);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.3 — Expired / Invalid Sessions
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.3 — Expired / Invalid Sessions", () => {
  const realImpl = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  ).getTenantContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantContext.mockImplementation(realImpl);
  });

  it("should throw TenantError UNAUTHENTICATED when userId is null", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await expect(getTenantContext()).rejects.toThrow(TenantError);
    await expect(getTenantContext()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("should throw TenantError UNAUTHENTICATED when orgId is null", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: null, orgRole: null });

    await expect(getTenantContext()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("should throw TenantError UNAUTHENTICATED when both userId and orgId are null", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await expect(getTenantContext()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("should throw TenantError with descriptive message for missing session", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    let caughtError: unknown;
    try {
      await getTenantContext();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(TenantError);
    expect((caughtError as TenantError).message).toBeTruthy();
    expect((caughtError as TenantError).name).toBe("TenantError");
  });

  it("should throw TenantError FORBIDDEN when membership.isActive is false", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: ORG_ROLE });
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgUserFindFirst.mockResolvedValue({ role: "MEMBER", isActive: false });

    await expect(getTenantContext()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("should maintain TenantError prototype chain (instanceof check works across module boundaries)", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    let caughtError: unknown;
    try {
      await getTenantContext();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError instanceof TenantError).toBe(true);
  });

  it("should NOT expose Prisma messages in TenantError.message", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    let msg = "";
    try {
      await getTenantContext();
    } catch (err) {
      msg = (err as TenantError).message;
    }

    expect(msg).not.toMatch(/prisma/i);
    expect(msg).not.toMatch(/postgres/i);
    expect(msg).not.toMatch(/database/i);
    expect(msg).not.toMatch(/internal/i);
  });

  it("should NOT expose stack trace in TenantError.message", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    let caughtError: unknown;
    try {
      await getTenantContext();
    } catch (err) {
      caughtError = err;
    }

    // The message property should be a short human description, not a stack dump
    const message = (caughtError as TenantError).message;
    expect(message).not.toContain("at ");         // stack frames
    expect(message).not.toContain("Error: ");     // nested error strings
  });

  it("should return a generic client-safe error message when action catches TenantError UNAUTHENTICATED", async () => {
    // createBoard is wrapped in createSafeAction which maps TenantErrors to generic strings.
    // Simulate: getTenantContext throws UNAUTHENTICATED inside the action handler.
    mockGetTenantContext.mockRejectedValue(new TenantError("UNAUTHENTICATED", "No active session"));

    const result = await createBoard({ title: "Should Fail" });

    expect(result.error).toBe("You must be signed in to perform this action.");
    // Must never expose internal IDs or Prisma details to the client
    expect(result.error).not.toMatch(/prisma/i);
    expect(result.error).not.toMatch(/database/i);
    expect(result.error).not.toContain(USER_ID);
    expect(result.error).not.toContain(ORG_ID);
  });

  it("should return a generic FORBIDDEN message when requireRole throws inside an action", async () => {
    mockGetTenantContext.mockRejectedValue(new TenantError("FORBIDDEN", "Requires ADMIN role or higher"));

    const result = await createBoard({ title: "Should Fail" });

    expect(result.error).toBe("You do not have permission to perform this action.");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.4 — Demo Mode
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.4 — Demo Mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore rate limiting to allow for all action tests in this section
    (jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock }).checkRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetInMs: 60_000,
    });
  });

  // ── isDemoContext() — pure function ──────────────────────────────────────

  describe("isDemoContext()", () => {
    const makeCtx = (orgId: string): TenantContext => ({
      userId: "u1",
      orgId,
      orgRole: "org:member",
      membership: { role: "MEMBER", isActive: true },
    });

    it("should return true for the exact default demo org id 'demo-org-id'", () => {
      expect(isDemoContext(makeCtx("demo-org-id"))).toBe(true);
    });

    it("should return false for 'DEMO-ORG-ID' (uppercase — case-sensitive check)", () => {
      expect(isDemoContext(makeCtx("DEMO-ORG-ID"))).toBe(false);
    });

    it("should return false for 'Demo-Org-Id' (mixed case)", () => {
      expect(isDemoContext(makeCtx("Demo-Org-Id"))).toBe(false);
    });

    it("should return false for a string that contains demo-org-id as a prefix but has extra chars", () => {
      expect(isDemoContext(makeCtx("demo-org-id-2"))).toBe(false);
    });

    it("should return false for 'demo-org' (shorter prefix)", () => {
      expect(isDemoContext(makeCtx("demo-org"))).toBe(false);
    });

    it("should return false for an arbitrary non-demo orgId", () => {
      expect(isDemoContext(makeCtx("org_production_abc123"))).toBe(false);
    });

    it("should return false for an empty-string orgId", () => {
      expect(isDemoContext(makeCtx(""))).toBe(false);
    });

    it("should use DEMO_ORG_ID env var when it is set, overriding the default", () => {
      const originalEnv = process.env.DEMO_ORG_ID;
      process.env.DEMO_ORG_ID = "custom-demo-org";

      try {
        // Custom env var matches
        expect(isDemoContext(makeCtx("custom-demo-org"))).toBe(true);
        // Default no longer matches when env var overrides it
        expect(isDemoContext(makeCtx("demo-org-id"))).toBe(false);
      } finally {
        // Restore env
        if (originalEnv === undefined) {
          delete process.env.DEMO_ORG_ID;
        } else {
          process.env.DEMO_ORG_ID = originalEnv;
        }
      }
    });

    it("should be a synchronous pure function (no async, no side effects)", () => {
      const ctx = makeCtx("demo-org-id");
      const result = isDemoContext(ctx);
      // Must return a plain boolean synchronously
      expect(typeof result).toBe("boolean");
      expect(result).not.toBeInstanceOf(Promise);
    });
  });

  // ── Mutation blocking in demo mode ───────────────────────────────────────

  describe("Mutation actions block writes in demo mode", () => {
    beforeEach(() => {
      // Inject demo context into getTenantContext for all action tests here
      mockGetTenantContext.mockResolvedValue(DEMO_CTX);
    });

    it("should return error when createBoard is called with demo org context", async () => {
      const result = await createBoard({ title: "New Board" });

      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    });

    it("should NOT contain 'demo-org-id' in the action error message", async () => {
      const result = await createBoard({ title: "New Board" });

      expect(result.error).not.toContain("demo-org-id");
    });

    it("should NOT contain 'Prisma' in the action error message", async () => {
      const result = await createBoard({ title: "New Board" });

      expect(result.error).not.toMatch(/prisma/i);
    });

    it("should NOT contain 'database' in the action error message", async () => {
      const result = await createBoard({ title: "New Board" });

      expect(result.error).not.toMatch(/database/i);
    });

    it("should NOT contain internal org UUIDs in the action error message", async () => {
      const result = await createBoard({ title: "New Board" });

      expect(result.error).not.toContain(ORG_ID);
    });

    it("should NOT call db.organization.findUnique before returning demo error (no DB write)", async () => {
      await createBoard({ title: "New Board" });

      // The demo guard fires before the first DB call in the handler
      expect(mockOrgFindUnique).not.toHaveBeenCalled();
    });

    it("should NOT call db.organization.create in demo mode", async () => {
      await createBoard({ title: "New Board" });

      expect(db.organization.create as jest.Mock).not.toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.5 — requireRole() Role Hierarchy
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.5 — requireRole() Role Hierarchy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeCtx = (role: TenantRole): TenantContext => ({
    userId: USER_ID,
    orgId: ORG_ID,
    orgRole: "org:member",
    membership: { role, isActive: true },
  });

  // ── ROLE_HIERARCHY values ────────────────────────────────────────────────

  it("should define GUEST weight as 1", () => {
    expect(ROLE_HIERARCHY.GUEST).toBe(1);
  });

  it("should define MEMBER weight as 2", () => {
    expect(ROLE_HIERARCHY.MEMBER).toBe(2);
  });

  it("should define ADMIN weight as 3", () => {
    expect(ROLE_HIERARCHY.ADMIN).toBe(3);
  });

  it("should define OWNER weight as 4", () => {
    expect(ROLE_HIERARCHY.OWNER).toBe(4);
  });

  it("should order roles numerically: GUEST < MEMBER < ADMIN < OWNER", () => {
    expect(ROLE_HIERARCHY.GUEST).toBeLessThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.OWNER);
  });

  it("should use numeric comparison, not lexicographic string comparison", () => {
    // "OWNER" > "ADMIN" lexicographically (O > A), so string comparison would match.
    // But "MEMBER" > "ADMIN" lexicographically (M > A), which would INCORRECTLY allow
    // a MEMBER to pass an ADMIN check if comparison were string-based.
    // Verifying the weights are numbers, not strings.
    expect(typeof ROLE_HIERARCHY.MEMBER).toBe("number");
    expect(typeof ROLE_HIERARCHY.ADMIN).toBe("number");
  });

  // ── requireRole() — happy paths ─────────────────────────────────────────

  it("should allow MEMBER when minimum role is MEMBER", async () => {
    const ctx = makeCtx("MEMBER");
    await expect(requireRole("MEMBER", ctx)).resolves.toMatchObject({ membership: { role: "MEMBER" } });
  });

  it("should allow ADMIN when minimum role is MEMBER", async () => {
    const ctx = makeCtx("ADMIN");
    await expect(requireRole("MEMBER", ctx)).resolves.toMatchObject({ membership: { role: "ADMIN" } });
  });

  it("should allow OWNER when minimum role is ADMIN", async () => {
    const ctx = makeCtx("OWNER");
    await expect(requireRole("ADMIN", ctx)).resolves.toMatchObject({ membership: { role: "OWNER" } });
  });

  it("should allow OWNER when minimum role is OWNER", async () => {
    const ctx = makeCtx("OWNER");
    await expect(requireRole("OWNER", ctx)).resolves.toMatchObject({ membership: { role: "OWNER" } });
  });

  // ── requireRole() — forbidden paths from spec matrix ────────────────────

  it("should throw TenantError FORBIDDEN when GUEST attempts MEMBER action (createCard)", async () => {
    await expect(requireRole("MEMBER", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should throw TenantError FORBIDDEN when MEMBER attempts ADMIN action (deleteBoard setting)", async () => {
    await expect(requireRole("ADMIN", makeCtx("MEMBER"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should throw TenantError FORBIDDEN when ADMIN attempts OWNER action (billing)", async () => {
    await expect(requireRole("OWNER", makeCtx("ADMIN"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should throw TenantError FORBIDDEN when GUEST attempts ADMIN action (automation create)", async () => {
    await expect(requireRole("ADMIN", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should throw TenantError FORBIDDEN when GUEST attempts OWNER action (manage members)", async () => {
    await expect(requireRole("OWNER", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should return context on success (allowing callers to chain without re-calling auth)", async () => {
    const ctx = makeCtx("ADMIN");
    const returned = await requireRole("MEMBER", ctx);

    // Must return the full context for callers to use downstream
    expect(returned).toMatchObject(ctx);
  });

  it("should fetch context from auth when ctx param is omitted", async () => {
    // requireRole calls the module-local getTenantContext when ctx is undefined.
    // We verify this behaviorally: configure auth+db mocks so it succeeds and
    // returns a context containing the expected role.
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: "org:admin" });
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgUserFindFirst.mockResolvedValue({ role: "ADMIN", isActive: true });

    // Should resolve with a valid context when real getTenantContext succeeds
    const ctx = await requireRole("MEMBER");

    expect(ctx).toMatchObject({
      userId: USER_ID,
      orgId: ORG_ID,
      membership: { role: "ADMIN", isActive: true },
    });
  });

  it("should return the supplied ctx unchanged when ctx param is provided", async () => {
    // When ctx is supplied, requireRole short-circuits the getTenantContext call
    // and uses the provided ctx directly. Verify the same object reference
    // (or equivalent shape) is returned.
    const ctx = makeCtx("MEMBER");

    const returned = await requireRole("MEMBER", ctx);

    // Must return an object equivalent to the supplied ctx
    expect(returned).toMatchObject(ctx);
    // DB should not be touched — proving no auth round-trip occurred
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockOrgUserFindFirst).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1.6 — normalizeClerkRole() (tested via healing path side-effects)
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 1.6 — normalizeClerkRole() via OrganizationUser healing path", () => {
  const realImpl = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  ).getTenantContext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantContext.mockImplementation(realImpl);
    // All paths need an existing user row and org row
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockOrgFindUnique.mockResolvedValue({ id: ORG_ID });
    mockOrgUserCreate.mockResolvedValue({});
    // No existing membership — forces healing path where clerkRole is normalised
    mockOrgUserFindFirst.mockResolvedValue(null);
  });

  it.each<[string, TenantRole]>([
    ["org:admin",   "ADMIN"],
    ["org:owner",   "OWNER"],
    ["org:member",  "MEMBER"],
    ["org:guest",   "GUEST"],
    ["admin",       "ADMIN"],
    ["owner",       "OWNER"],
    ["guest",       "GUEST"],
  ])("should normalize Clerk role '%s' to TenantRole '%s'", async (clerkRole, expectedRole) => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: clerkRole });

    const ctx = await getTenantContext();

    expect(ctx.membership.role).toBe(expectedRole);
    expect(mockOrgUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: expectedRole }),
      })
    );
  });

  it("should default to MEMBER when clerkRole is null", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: null });

    const ctx = await getTenantContext();

    expect(ctx.membership.role).toBe("MEMBER");
  });

  it("should default to MEMBER for an unrecognised role string", async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: "org:collaborator" });

    const ctx = await getTenantContext();

    expect(ctx.membership.role).toBe("MEMBER");
  });

  it("should use local DB role when OrganizationUser row already exists (not clerkRole)", async () => {
    // Override: membership exists with ADMIN — clerkRole says member
    mockOrgUserFindFirst.mockResolvedValue({ role: "ADMIN", isActive: true });
    mockAuth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID, orgRole: "org:member" });

    const ctx = await getTenantContext();

    // Local DB role wins over JWT role
    expect(ctx.membership.role).toBe("ADMIN");
    expect(mockOrgUserCreate).not.toHaveBeenCalled();
  });
});
