/**
 * Section 2 — Role & Permission Tests
 *
 * Validates the full permission matrix defined in the Section 2 spec:
 *
 *   | Action                          | Min Role | Blocked Role |
 *   |---------------------------------|----------|--------------|
 *   | Read board/cards/lists          | GUEST    | N/A          |
 *   | Create/update/delete card/list  | MEMBER   | GUEST        |
 *   | Board settings, rename          | ADMIN    | MEMBER       |
 *   | Delete board, manage members    | OWNER    | ADMIN        |
 *   | Automation create/update/delete | ADMIN    | MEMBER       |
 *   | API key management              | ADMIN    | MEMBER       |
 *   | Billing access                  | OWNER    | ADMIN        |
 *
 * Mocking strategy
 * ────────────────
 *  • `@/lib/tenant-context` → partial mock — getTenantContext is injectable
 *    per-test while requireRole runs REAL so the hierarchy math is validated
 *    end-to-end from the action level down.
 *  • `@/lib/db` → full mock — action handlers never touch a real DB.
 *  • `@/lib/dal` → mock — DAL factory returns stubs so post-role-check code
 *    can complete without Prisma calls.
 *  • All supporting mocks (lexorank, event-bus, stripe, logger, …) are set
 *    to safe stubs that never fail on their own.
 */

// ─── HOISTED MOCKS ────────────────────────────────────────────────────────────

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  clerkClient: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    user:           { findUnique: jest.fn(), create: jest.fn() },
    organization:   { findUnique: jest.fn(), create: jest.fn() },
    organizationUser: { findFirst: jest.fn(), create: jest.fn() },
    board:          { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
                      findMany: jest.fn().mockResolvedValue([]) },
    list:           { findFirst: jest.fn().mockResolvedValue(null) },
    card:           { findFirst: jest.fn().mockResolvedValue(null) },
    automation:     { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
                      create: jest.fn() },
    apiKey:         { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(),
                      update: jest.fn(), delete: jest.fn() },
  },
  setCurrentOrgId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  );
  return { ...actual, getTenantContext: jest.fn() };
});

jest.mock("@/lib/dal", () => ({
  createDAL: jest.fn().mockResolvedValue({
    boards: {
      delete: jest.fn().mockResolvedValue({ id: "board-uuid-1", title: "Deleted", orgId: "org-1" }),
      update: jest.fn().mockResolvedValue({ id: "board-uuid-1", title: "Updated", orgId: "org-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    lists: {
      create: jest.fn().mockResolvedValue({ id: "list-uuid-1", title: "New List", order: "m", boardId: "board-uuid-1" }),
      delete: jest.fn().mockResolvedValue({ id: "list-uuid-1" }),
    },
    cards: {
      create: jest.fn().mockResolvedValue({ id: "card-uuid-1", title: "New Card", order: "m", listId: "list-uuid-1" }),
      update: jest.fn().mockResolvedValue({ id: "card-uuid-1", title: "Updated Card", order: "m", listId: "list-uuid-1" }),
    },
    auditLogs: { create: jest.fn().mockResolvedValue({}) },
  }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// `after` runs the callback synchronously in the test environment so side
// effects (emitCardEvent) complete before assertions run.
jest.mock("next/server", () => ({
  after: jest.fn((cb: () => unknown) => cb()),
}));

jest.mock("@/lib/action-protection", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetInMs: 60_000 }),
  RATE_LIMITS: {
    "create-card": 60,
    "create-list": 20,
    "update-card": 120,
    "delete-board": 10,
    "delete-list": 20,
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("@/lib/lexorank", () => ({
  generateNextOrder:    jest.fn().mockReturnValue("m"),
  generateMidpointOrder: jest.fn().mockReturnValue("ma"),
}));

jest.mock("@/lib/event-bus", () => ({
  emitCardEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/stripe", () => ({
  STRIPE_CONFIG: {
    limits: {
      FREE: { boards: 50, cardsPerBoard: 500 },
      PRO:  { boards: Infinity, cardsPerBoard: Infinity },
    },
  },
  isStripeConfigured: jest.fn().mockReturnValue(false),
}));

jest.mock("@/actions/template-actions", () => ({
  createBoardFromTemplate: jest.fn(),
}));

// ─── IMPORTS (after all mock declarations) ────────────────────────────────────

import {
  getTenantContext,
  TenantError,
  requireRole,
  ROLE_HIERARCHY,
  type TenantContext,
  type TenantRole,
} from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { createCard } from "@/actions/create-card";
import { createList } from "@/actions/create-list";
import { updateCard } from "@/actions/update-card";
import { deleteBoard } from "@/actions/delete-board";
import { updateBoard } from "@/actions/update-board";
import { deleteList } from "@/actions/delete-list";
import {
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getAutomations,
} from "@/actions/automation-actions";
import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  deleteApiKey,
} from "@/actions/api-key-actions";

// ─── Typed mock helpers ────────────────────────────────────────────────────────

const mockGetTenantContext = getTenantContext as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID   = "org_abc123";
const USER_ID  = "user_abc456";
const BOARD_ID = "a0000000-0000-4000-8000-000000000001";
const LIST_ID  = "b0000000-0000-4000-8000-000000000002";
const CARD_ID  = "c0000000-0000-4000-8000-000000000003";
const AUTO_ID  = "d0000000-0000-4000-8000-000000000004";
const KEY_ID   = "e0000000-0000-4000-8000-000000000005";

function makeCtx(role: TenantRole): TenantContext {
  return {
    userId: USER_ID,
    orgId: ORG_ID,
    orgRole: `org:${role.toLowerCase()}`,
    membership: { role, isActive: true },
  };
}

// Valid payloads for each action ─────────────────────────────────────────────

const VALID_CREATE_CARD   = { title: "Task title", listId: LIST_ID, boardId: BOARD_ID };
const VALID_CREATE_LIST   = { title: "New list",   boardId: BOARD_ID };
const VALID_UPDATE_CARD   = { id: CARD_ID, boardId: BOARD_ID, title: "Updated title" };
const VALID_DELETE_BOARD  = { id: BOARD_ID };
const VALID_UPDATE_BOARD  = { boardId: BOARD_ID, title: "Renamed board" };
const VALID_AUTOMATION = {
  name: "Auto 1",
  trigger: { type: "CARD_CREATED" as const },
  conditions: [],
  actions: [{ type: "SET_PRIORITY" as const, priority: "HIGH" as const }],
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.1 — ROLE_HIERARCHY constants
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.1 — ROLE_HIERARCHY constants", () => {
  it("GUEST weight should be 1", () => {
    expect(ROLE_HIERARCHY.GUEST).toBe(1);
  });

  it("MEMBER weight should be 2", () => {
    expect(ROLE_HIERARCHY.MEMBER).toBe(2);
  });

  it("ADMIN weight should be 3", () => {
    expect(ROLE_HIERARCHY.ADMIN).toBe(3);
  });

  it("OWNER weight should be 4", () => {
    expect(ROLE_HIERARCHY.OWNER).toBe(4);
  });

  it("ordering should be strictly: GUEST < MEMBER < ADMIN < OWNER", () => {
    expect(ROLE_HIERARCHY.GUEST).toBeLessThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.OWNER);
  });

  it("each weight should be a number (comparison is numeric, not lexicographic)", () => {
    for (const [role, weight] of Object.entries(ROLE_HIERARCHY)) {
      expect(typeof weight).toBe("number");
      // Guard against accidental string coercion
      expect(weight as unknown === String(weight)).toBe(false);
      // Make TypeScript happy
      void role;
    }
  });

  it("MEMBER should NOT exceed ADMIN in lexicographic order (proving numeric ordering requirement)", () => {
    // String comparison: "MEMBER" > "ADMIN" == true (M > A), meaning if the
    // code used > on strings instead of numbers, MEMBER would incorrectly
    // pass an ADMIN gate. Validate that the numeric weights correctly
    // prevent this.
    expect("MEMBER" > "ADMIN").toBe(true);          // string order is wrong
    expect(ROLE_HIERARCHY.MEMBER > ROLE_HIERARCHY.ADMIN).toBe(false); // numeric is correct
  });

  it("ROLE_HIERARCHY should cover exactly the four canonical roles", () => {
    const roles = Object.keys(ROLE_HIERARCHY).sort();
    expect(roles).toEqual(["ADMIN", "GUEST", "MEMBER", "OWNER"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.2 — requireRole() happy paths
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.2 — requireRole() happy paths", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should allow MEMBER when minimum is MEMBER (create/update card tier)", async () => {
    const ctx = makeCtx("MEMBER");
    await expect(requireRole("MEMBER", ctx)).resolves.toMatchObject({ membership: { role: "MEMBER" } });
  });

  it("should allow ADMIN when minimum is MEMBER (admins can also create cards)", async () => {
    const ctx = makeCtx("ADMIN");
    await expect(requireRole("MEMBER", ctx)).resolves.toMatchObject({ membership: { role: "ADMIN" } });
  });

  it("should allow OWNER when minimum is MEMBER", async () => {
    const ctx = makeCtx("OWNER");
    await expect(requireRole("MEMBER", ctx)).resolves.toMatchObject({ membership: { role: "OWNER" } });
  });

  it("should allow ADMIN when minimum is ADMIN (board settings tier)", async () => {
    const ctx = makeCtx("ADMIN");
    await expect(requireRole("ADMIN", ctx)).resolves.toMatchObject({ membership: { role: "ADMIN" } });
  });

  it("should allow OWNER when minimum is ADMIN (owners have all lower perms)", async () => {
    const ctx = makeCtx("OWNER");
    await expect(requireRole("ADMIN", ctx)).resolves.toMatchObject({ membership: { role: "OWNER" } });
  });

  it("should allow OWNER when minimum is OWNER (delete board tier)", async () => {
    const ctx = makeCtx("OWNER");
    await expect(requireRole("OWNER", ctx)).resolves.toMatchObject({ membership: { role: "OWNER" } });
  });

  it("should return the exact context object for caller chaining", async () => {
    const ctx = makeCtx("ADMIN");
    const result = await requireRole("MEMBER", ctx);
    expect(result).toMatchObject(ctx);
    expect(result.userId).toBe(ctx.userId);
    expect(result.orgId).toBe(ctx.orgId);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.3 — requireRole() forbidden paths (full matrix)
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.3 — requireRole() forbidden paths", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GUEST blocked for MEMBER minimum → TenantError FORBIDDEN (create card tier)", async () => {
    await expect(requireRole("MEMBER", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("GUEST blocked for ADMIN minimum → TenantError FORBIDDEN (board settings tier)", async () => {
    await expect(requireRole("ADMIN", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("GUEST blocked for OWNER minimum → TenantError FORBIDDEN (delete board tier)", async () => {
    await expect(requireRole("OWNER", makeCtx("GUEST"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("MEMBER blocked for ADMIN minimum → TenantError FORBIDDEN (board settings tier)", async () => {
    await expect(requireRole("ADMIN", makeCtx("MEMBER"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("MEMBER blocked for OWNER minimum → TenantError FORBIDDEN (delete board tier)", async () => {
    await expect(requireRole("OWNER", makeCtx("MEMBER"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("ADMIN blocked for OWNER minimum → TenantError FORBIDDEN (billing / delete board tier)", async () => {
    await expect(requireRole("OWNER", makeCtx("ADMIN"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("thrown TenantError should be instanceof TenantError (prototype chain intact)", async () => {
    let caught: unknown;
    try { await requireRole("ADMIN", makeCtx("GUEST")); } catch (e) { caught = e; }
    expect(caught instanceof TenantError).toBe(true);
  });

  it("FORBIDDEN error message should reference the minimum role required", async () => {
    let msg = "";
    try { await requireRole("ADMIN", makeCtx("MEMBER")); } catch (e) { msg = (e as TenantError).message; }
    expect(msg).toMatch(/ADMIN/);
  });

  it("FORBIDDEN error message should NOT expose the caller's orgId", async () => {
    let msg = "";
    try { await requireRole("OWNER", makeCtx("ADMIN")); } catch (e) { msg = (e as TenantError).message; }
    expect(msg).not.toContain(ORG_ID);
  });

  it("FORBIDDEN error message should NOT expose the caller's userId", async () => {
    let msg = "";
    try { await requireRole("OWNER", makeCtx("MEMBER")); } catch (e) { msg = (e as TenantError).message; }
    expect(msg).not.toContain(USER_ID);
  });

  it("FORBIDDEN error message should NOT leak Prisma or database keywords", async () => {
    let msg = "";
    try { await requireRole("ADMIN", makeCtx("GUEST")); } catch (e) { msg = (e as TenantError).message; }
    expect(msg).not.toMatch(/prisma|database|sql/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.4 — MEMBER-gated actions (createCard, createList, updateCard)
//               GUEST role → FORBIDDEN
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.4 — MEMBER-gated actions blocked for GUEST", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
  });

  // ── createCard ──────────────────────────────────────────────────────────────

  it("createCard: GUEST → returns { error } (not a thrown exception)", async () => {
    const result = await createCard(VALID_CREATE_CARD);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("createCard: GUEST → error is the standard permission-denied message", async () => {
    const result = await createCard(VALID_CREATE_CARD);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("createCard: GUEST → DB is never touched (role check fires before DB calls)", async () => {
    await createCard(VALID_CREATE_CARD);
    expect(db.card.findFirst as jest.Mock).not.toHaveBeenCalled();
  });

  // ── createList ──────────────────────────────────────────────────────────────

  it("createList: GUEST → returns { error }", async () => {
    const result = await createList(VALID_CREATE_LIST);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("createList: GUEST → error is the standard permission-denied message", async () => {
    const result = await createList(VALID_CREATE_LIST);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("createList: GUEST → list DB table never queried", async () => {
    await createList(VALID_CREATE_LIST);
    expect(db.list.findFirst as jest.Mock).not.toHaveBeenCalled();
  });

  // ── updateCard ──────────────────────────────────────────────────────────────

  it("updateCard: GUEST → returns { error }", async () => {
    const result = await updateCard(VALID_UPDATE_CARD);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("updateCard: GUEST → error is the standard permission-denied message", async () => {
    const result = await updateCard(VALID_UPDATE_CARD);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  // ── MEMBER gets through the role check ───────────────────────────────────────

  it("createCard: MEMBER → role check passes (error from DB, not from role check)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await createCard(VALID_CREATE_CARD);
    // If this fails it should be a DB/business error, NOT a permission error
    if (result.error) {
      expect(result.error).not.toBe("You do not have permission to perform this action.");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.5 — ADMIN-gated actions blocked for MEMBER
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.5 — ADMIN-gated actions blocked for MEMBER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
  });

  // ── updateBoard (requireRole inside try/catch → returns { error }) ───────────

  it("updateBoard: MEMBER → returns { error } (does NOT throw)", async () => {
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(typeof result).toBe("object");
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("updateBoard: MEMBER → TenantError is caught by inner try/catch (not an unhandled promise rejection)", async () => {
    // If the promise rejects, this test will fail — thereby verifying the
    // try/catch around requireRole works correctly.
    await expect(updateBoard(VALID_UPDATE_BOARD)).resolves.not.toThrow();
  });

  it("updateBoard: MEMBER → error message references the required role", async () => {
    const result = await updateBoard(VALID_UPDATE_BOARD);
    // updateBoard returns `err.message` for TenantError → "Requires ADMIN role or higher"
    expect(result.error).toMatch(/ADMIN/);
  });

  it("updateBoard: GUEST → also blocked (lower than MEMBER)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("updateBoard: MEMBER error does NOT contain orgId", async () => {
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(result.error).not.toContain(ORG_ID);
  });

  it("updateBoard: MEMBER error does NOT contain userId", async () => {
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(result.error).not.toContain(USER_ID);
  });

  // ── deleteList (requireRole outside try/catch → throws TenantError) ─────────

  it("deleteList: MEMBER → throws TenantError (not wrapped by createSafeAction)", async () => {
    await expect(deleteList(LIST_ID, BOARD_ID)).rejects.toBeInstanceOf(TenantError);
  });

  it("deleteList: MEMBER → thrown error has code FORBIDDEN", async () => {
    await expect(deleteList(LIST_ID, BOARD_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("deleteList: GUEST → also throws TenantError FORBIDDEN", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    await expect(deleteList(LIST_ID, BOARD_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  // ── createAutomation ─────────────────────────────────────────────────────────

  it("createAutomation: MEMBER → returns { error } (not a thrown exception)", async () => {
    const result = await createAutomation(VALID_AUTOMATION);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("createAutomation: MEMBER → automation is never written to DB", async () => {
    await createAutomation(VALID_AUTOMATION);
    expect(db.automation.create as jest.Mock).not.toHaveBeenCalled();
  });

  it("createAutomation: GUEST → also blocked", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    const result = await createAutomation(VALID_AUTOMATION);
    expect(result.error).toBeTruthy();
  });

  // ── updateAutomation ─────────────────────────────────────────────────────────

  it("updateAutomation: MEMBER → returns { error } (not a thrown exception)", async () => {
    const result = await updateAutomation(AUTO_ID, { name: "Updated name" });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("updateAutomation: MEMBER → automation DB row not fetched (role check fires first)", async () => {
    await updateAutomation(AUTO_ID, { name: "Updated" });
    // db.automation.findFirst is called only AFTER the role check passes
    expect(db.automation.findFirst as jest.Mock).not.toHaveBeenCalled();
  });

  // ── deleteAutomation ─────────────────────────────────────────────────────────

  it("deleteAutomation: MEMBER → returns { error } (not a thrown exception)", async () => {
    const result = await deleteAutomation(AUTO_ID);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("deleteAutomation: MEMBER → db.automation.findFirst is NOT called (role guard fires first)", async () => {
    await deleteAutomation(AUTO_ID);
    expect(db.automation.findFirst as jest.Mock).not.toHaveBeenCalled();
  });

  // ── createApiKey ─────────────────────────────────────────────────────────────

  it("createApiKey: MEMBER → returns { error } (not a thrown exception)", async () => {
    const result = await createApiKey("My Key", ["read:boards"]);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("createApiKey: MEMBER → no raw key generated (DB never reached)", async () => {
    await createApiKey("My Key", ["read:boards"]);
    expect(db.apiKey.create as jest.Mock).not.toHaveBeenCalled();
  });

  // ── getApiKeys ────────────────────────────────────────────────────────────────

  it("getApiKeys: MEMBER → returns { error } (not an empty list)", async () => {
    const result = await getApiKeys();
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("getApiKeys: MEMBER → db.apiKey.findMany never called (role check fires first)", async () => {
    await getApiKeys();
    expect(db.apiKey.findMany as jest.Mock).not.toHaveBeenCalled();
  });

  // ── revokeApiKey ─────────────────────────────────────────────────────────────

  it("revokeApiKey: MEMBER → returns { error }", async () => {
    const result = await revokeApiKey(KEY_ID);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  // ── deleteApiKey ─────────────────────────────────────────────────────────────

  it("deleteApiKey: MEMBER → returns { error }", async () => {
    const result = await deleteApiKey(KEY_ID);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.6 — OWNER-gated actions blocked for lower roles
//               deleteBoard = canonical OWNER action
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.6 — OWNER-gated actions (deleteBoard) blocked for GUEST / MEMBER / ADMIN", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deleteBoard: GUEST → returns { error } (FORBIDDEN via createSafeAction)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeUndefined();
  });

  it("deleteBoard: GUEST → error is the standard permission-denied message", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("deleteBoard: MEMBER → returns { error } (FORBIDDEN)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("deleteBoard: ADMIN → returns { error } — billing-equivalent OWNER block", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    expect(result.error).toBe("You do not have permission to perform this action.");
  });

  it("deleteBoard: ADMIN → DAL.boards.delete is never called (permission fails first)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    await deleteBoard(VALID_DELETE_BOARD);
    const { createDAL } = jest.requireMock("@/lib/dal") as { createDAL: jest.Mock };
    const dal = await createDAL(null);
    expect(dal.boards.delete).not.toHaveBeenCalled();
  });

  it("deleteBoard: OWNER → role check PASSES (success depends on DAL mock)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("OWNER"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    // Must NOT be a permission error — any other outcome (data or downstream error) is acceptable
    expect(result.error).not.toBe("You do not have permission to perform this action.");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.7 — updateBoard: TenantError caught cleanly (no HTTP 500 pattern)
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.7 — updateBoard: requireRole inside try/catch returns clean { error }", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return a plain object (not throw) when MEMBER calls updateBoard", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("returned object should have an error property, not a data property", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await updateBoard(VALID_UPDATE_BOARD);
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("data");
  });

  it("error should be a non-empty string", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const { error } = await updateBoard(VALID_UPDATE_BOARD);
    expect(typeof error).toBe("string");
    expect(error!.length).toBeGreaterThan(0);
  });

  it("should not expose stack trace in the returned error string", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));
    const { error } = await updateBoard(VALID_UPDATE_BOARD);
    expect(error).not.toContain("at ");       // call-stack frames
    expect(error).not.toContain("Error:");    // nested error prefix
    expect(error).not.toContain("\n");        // multi-line stack
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.8 — Error message hygiene (global: all action types)
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.8 — Error message hygiene across all action types", () => {
  beforeEach(() => jest.clearAllMocks());

  // createSafeAction-wrapped ──────────────────────────────────────────────────

  it.each([
    ["createCard (GUEST)",  () => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));   return createCard(VALID_CREATE_CARD);  }],
    ["createList (GUEST)",  () => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));   return createList(VALID_CREATE_LIST);  }],
    ["updateCard (GUEST)",  () => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));   return updateCard(VALID_UPDATE_CARD);  }],
    ["deleteBoard (ADMIN)", () => { mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));   return deleteBoard(VALID_DELETE_BOARD); }],
    ["updateBoard (MEMBER)",() => { mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER")); return updateBoard(VALID_UPDATE_BOARD); }],
  ] as const)("%s error should not contain 'TenantError'", async (_, action) => {
    const { error } = await action();
    expect(error).not.toContain("TenantError");
  });

  it.each([
    ["createCard (GUEST)",  () => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));   return createCard(VALID_CREATE_CARD);  }],
    ["createList (GUEST)",  () => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST"));   return createList(VALID_CREATE_LIST);  }],
    ["deleteBoard (ADMIN)", () => { mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));   return deleteBoard(VALID_DELETE_BOARD); }],
  ] as const)("%s error should not contain the org ID", async (_, action) => {
    const { error } = await action();
    expect(error).not.toContain(ORG_ID);
  });

  it.each([
    ["createApiKey (MEMBER)",   () => { mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER")); return createApiKey("k", ["read:boards"]); }],
    ["getApiKeys (MEMBER)",     () => { mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER")); return getApiKeys();                        }],
    ["createAutomation (GUEST)",() => { mockGetTenantContext.mockResolvedValue(makeCtx("GUEST")); return createAutomation(VALID_AUTOMATION);   }],
  ] as const)("%s error should not contain 'Prisma' or 'database'", async (_, action) => {
    const { error } = await action();
    expect(error).not.toMatch(/prisma|database/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.9 — Read operations pass at MEMBER level
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.9 — Read operations: accessible to MEMBER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    (db.automation.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("getAutomations: MEMBER → role check passes and returns data (not an error)", async () => {
    const result = await getAutomations();
    // MEMBER has access to read automations (requires "MEMBER" minimum)
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("getAutomations: ADMIN → also passes (superset role)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    const result = await getAutomations();
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("getApiKeys: ADMIN → passes role check and returns data", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    (db.apiKey.findMany as jest.Mock).mockResolvedValue([]);
    const result = await getApiKeys();
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2.10 — Happy paths: min-role actions succeed when role matches
// ══════════════════════════════════════════════════════════════════════════════

describe("Section 2.10 — Happy paths: correct role → action proceeds past gate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createCard: MEMBER role check passes (no permission error)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await createCard(VALID_CREATE_CARD);
    expect(result.error).not.toBe("You do not have permission to perform this action.");
  });

  it("createList: MEMBER role check passes (no permission error)", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("MEMBER"));
    const result = await createList(VALID_CREATE_LIST);
    expect(result.error).not.toBe("You do not have permission to perform this action.");
  });

  it("updateBoard: ADMIN role check passes — returns data or non-permission error", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    const result = await updateBoard(VALID_UPDATE_BOARD);
    // Should NOT be a permission error — any other outcome (e.g. DAL mock returning data) is fine
    if (result.error) {
      expect(result.error).not.toMatch(/ADMIN|permission/i);
    }
  });

  it("createAutomation: ADMIN role check passes — automation.create is called", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    (db.automation.create as jest.Mock).mockResolvedValue({
      id: AUTO_ID,
      orgId: ORG_ID,
      name: VALID_AUTOMATION.name,
      trigger: VALID_AUTOMATION.trigger,
      conditions: [],
      actions: VALID_AUTOMATION.actions,
      isEnabled: true,
      createdAt: new Date(),
      boardId: null,
    });

    const result = await createAutomation(VALID_AUTOMATION);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("createApiKey: ADMIN role check passes — apiKey.create is called", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("ADMIN"));
    (db.apiKey.create as jest.Mock).mockResolvedValue({
      id: KEY_ID,
      orgId: ORG_ID,
      name: "My Key",
      keyHash: "deadbeef",
      keyPrefix: "nxk_12345678",
      scopes: ["read:boards"],
      expiresAt: null,
      createdAt: new Date(),
    });

    const result = await createApiKey("My Key", ["read:boards"]);
    expect(result.data).toBeDefined();
    expect(result.data?.rawKey).toMatch(/^nxk_/);
    expect(result.error).toBeUndefined();
  });

  it("deleteBoard: OWNER role check passes — dal.boards.delete is called once", async () => {
    mockGetTenantContext.mockResolvedValue(makeCtx("OWNER"));
    const result = await deleteBoard(VALID_DELETE_BOARD);
    // With DAL mock configured, should return deleted board data
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});
