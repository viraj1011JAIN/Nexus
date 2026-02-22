/**
 * getTenantContext — unit tests
 *
 * Covers the four main code paths in lib/tenant-context.ts:
 *   1. No userId → UNAUTHENTICATED
 *   2. userId but no orgId → UNAUTHENTICATED
 *   3. Active membership exists but isActive=false → FORBIDDEN
 *   4. Active membership exists with isActive=true → returns TenantContext
 *
 * React's cache() is mocked to a passthrough so tests are independent.
 */

// Must precede all imports — Jest hoists jest.mock() calls
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  clerkClient: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

import { getTenantContext, TenantError } from "@/lib/tenant-context";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

describe("getTenantContext", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws UNAUTHENTICATED when there is no session (userId and orgId both null)", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null, orgId: null, orgRole: null });

    await expect(getTenantContext()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when userId exists but no org is selected (orgId null)", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: "user_123", orgId: null, orgRole: null });

    await expect(getTenantContext()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws FORBIDDEN when membership row has isActive=false", async () => {
    (auth as jest.Mock).mockResolvedValue({
      userId: "user_123",
      orgId: "org_abc",
      orgRole: "org:member",
    });
    (db.user.findUnique as jest.Mock).mockResolvedValue({ id: "uuid-1" });
    (db.organizationUser.findFirst as jest.Mock).mockResolvedValue({
      role: "MEMBER",
      isActive: false,
    });

    await expect(getTenantContext()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns TenantContext for a valid, active member", async () => {
    (auth as jest.Mock).mockResolvedValue({
      userId: "user_123",
      orgId: "org_abc",
      orgRole: "org:member",
    });
    (db.user.findUnique as jest.Mock).mockResolvedValue({ id: "uuid-1" });
    (db.organizationUser.findFirst as jest.Mock).mockResolvedValue({
      role: "MEMBER",
      isActive: true,
    });

    const ctx = await getTenantContext();

    expect(ctx.userId).toBe("user_123");
    expect(ctx.orgId).toBe("org_abc");
    expect(ctx.membership.role).toBe("MEMBER");
    expect(ctx.membership.isActive).toBe(true);
  });

  it("throws instance of TenantError with correct name", async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null, orgId: null });

    try {
      await getTenantContext();
      fail("expected getTenantContext to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TenantError);
      expect((err as TenantError).name).toBe("TenantError");
    }
  });
});
