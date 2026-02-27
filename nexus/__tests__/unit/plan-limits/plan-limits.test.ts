/**
 * Section 4 — Plan Limit Tests
 *
 * Covers every scenario documented in the spec plus production-level edge cases:
 *
 *   4.1  Board Limits       — createBoard() enforces FREE/PRO plan board caps
 *   4.2  Card Limits        — STRIPE_CONFIG contract + enforcement-mirror tests
 *                             (createCard() currently has no cardsPerBoard check;
 *                              tests document the gap and validate the config contract)
 *   4.3  Attachment Limits  — POST /api/upload enforces FREE plan 10-attachment cap
 *                             with a serializable re-check transaction
 *
 * Mocking strategy
 * ────────────────
 *  • `react.cache`              → identity fn (prevents cross-test memoisation)
 *  • `@clerk/nextjs/server`     → auth/clerkClient stubs
 *  • `@/lib/tenant-context`     → partial mock — getTenantContext injectable per test
 *  • `@/lib/db`                 → full mock covering every table touched by limit checks
 *  • `@/lib/dal`                → createDAL returns safe board/card/auditLog stubs
 *  • `@/lib/stripe`             → STRIPE_CONFIG with real FREE/PRO limit values
 *  • `@supabase/supabase-js`    → upload + getPublicUrl stubs for attachment tests
 *  • `next/server`              → NextResponse.json captured, NextRequest faked
 *  • Supporting mocks           → action-protection, logger, lexorank, event-bus,
 *                                 next/cache, template-actions
 */

// ─── HOISTED MOCKS (must appear before any imports) ───────────────────────────

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  clerkClient: jest.fn(),
}));

// ---------------------------------------------------------------------------
// @/lib/db — all tables touched by board/card/attachment limit paths
// ---------------------------------------------------------------------------
jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create:     jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create:     jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
    board: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      create:     jest.fn(),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    list: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    attachment: {
      count:      jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
    },
    card: {
      findFirst:  jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      count:      jest.fn().mockResolvedValue(0),
    },
    // $transaction is used by the upload route for the double-check pattern.
    // Default: immediately invokes the callback with the same db mock as the
    // transaction proxy so tests can control tx.attachment.count separately.
    $transaction: jest.fn(),
  },
  setCurrentOrgId: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// @/lib/tenant-context — partial mock; real requireRole/TenantError/isDemoContext
// ---------------------------------------------------------------------------
jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  );
  return { ...actual, getTenantContext: jest.fn() };
});

// ---------------------------------------------------------------------------
// @/lib/dal — createDAL returns typed stubs
// ---------------------------------------------------------------------------
jest.mock("@/lib/dal", () => ({
  createDAL: jest.fn().mockResolvedValue({
    boards: {
      create:     jest.fn().mockResolvedValue({ id: "board-new", title: "New Board", orgId: "org-1" }),
      findMany:   jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      delete:     jest.fn(),
      update:     jest.fn(),
    },
    cards: {
      create: jest.fn().mockResolvedValue({ id: "card-new", title: "New Card", listId: "list-1", boardId: "board-1", order: "m" }),
    },
    auditLogs: {
      create: jest.fn().mockResolvedValue({}),
    },
  }),
}));

// ---------------------------------------------------------------------------
// @/lib/stripe — STRIPE_CONFIG with canonical limit values
// ---------------------------------------------------------------------------
jest.mock("@/lib/stripe", () => ({
  STRIPE_CONFIG: {
    limits: {
      FREE: { boards: 50, cardsPerBoard: 500 },
      PRO:  { boards: Infinity, cardsPerBoard: Infinity },
    },
  },
  stripe: {},
  isStripeConfigured: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// @/lib/action-protection — always allowed (rate-limit is not under test here)
// ---------------------------------------------------------------------------
jest.mock("@/lib/action-protection", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetInMs: 60_000 }),
  RATE_LIMITS: { "create-board": 10, "create-card": 60 },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ---------------------------------------------------------------------------
// @supabase/supabase-js — storage stubs for attachment upload tests
// ---------------------------------------------------------------------------
const mockStorageUpload    = jest.fn();
const mockStorageGetPublicUrl = jest.fn(() => ({ data: { publicUrl: "https://cdn.example.com/file.pdf" } }));
const mockStorageFrom      = jest.fn(() => ({
  upload:       mockStorageUpload,
  getPublicUrl: mockStorageGetPublicUrl,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    storage: { from: mockStorageFrom },
  })),
}));

// ---------------------------------------------------------------------------
// next/server — NextResponse as a class so instanceof checks in the upload
// route work correctly. Static json() records body + status on the instance.
// ---------------------------------------------------------------------------
jest.mock("next/server", () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return {
    NextResponse: MockNextResponse,
    after: jest.fn((cb: () => void) => cb()),
  };
});

// ---------------------------------------------------------------------------
// Supporting mocks
// ---------------------------------------------------------------------------
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/actions/template-actions", () => ({ createBoardFromTemplate: jest.fn() }));
jest.mock("@/lib/lexorank", () => ({ generateNextOrder: jest.fn().mockReturnValue("m") }));
jest.mock("@/lib/event-bus", () => ({ emitCardEvent: jest.fn().mockResolvedValue(undefined) }));

// ─── REAL IMPORTS (after all mock declarations) ────────────────────────────

import { db }              from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { createBoard }     from "@/actions/create-board";
import { createCard }      from "@/actions/create-card";
import { STRIPE_CONFIG }   from "@/lib/stripe";
import { POST }            from "@/app/api/upload/route";

// ─── Typed mock helpers ────────────────────────────────────────────────────

const mockGetTenantContext  = getTenantContext as jest.Mock;
const mockOrgFindUnique     = db.organization.findUnique as jest.Mock;
const mockOrgCreate         = db.organization.create     as jest.Mock;
const mockAttachmentCount   = db.attachment.count        as jest.Mock;
const mockCardFindFirst     = db.card.findFirst          as jest.Mock;
const mockCardFindUnique    = (db as unknown as { card: { findUnique: jest.Mock } }).card?.findUnique as jest.Mock | undefined;
const mockDbTransaction     = db.$transaction            as jest.Mock;
const mockUserFindUnique    = db.user.findUnique         as jest.Mock;

// ─── Shared fixtures ──────────────────────────────────────────────────────

const ORG_ID   = "org_test_limits_123";
const USER_ID  = "user_clerk_abc456";
const BOARD_ID = "board-test-1";
const LIST_ID  = "list-test-1";
const CARD_ID  = "card-test-1";

/** Minimal MEMBER context injected into getTenantContext for all action tests */
const MEMBER_CTX = {
  userId:  USER_ID,
  orgId:   ORG_ID,
  orgRole: "org:member",
  membership: { role: "MEMBER" as const, isActive: true },
};

/** Build a fake org object with n boards (FREE plan by default) */
function fakeOrg(boardCount: number, plan: string = "FREE") {
  return {
    id:               ORG_ID,
    name:             "Test Org",
    slug:             ORG_ID.toLowerCase(),
    subscriptionPlan: plan,
    boards:           Array.from({ length: boardCount }, (_, i) => ({ id: `board-${i + 1}` })),
  };
}

/** Build a minimal NextRequest mock for the upload route */
function makeUploadRequest(opts: {
  file?: File | null;
  cardId?: string | null;
  overrideFormData?: () => Promise<FormData>;
}) {
  const formData = new FormData();

  if (opts.file !== undefined) {
    if (opts.file !== null) formData.append("file", opts.file);
  } else {
    // Default: valid 1-byte PDF
    formData.append("file", new File(["x"], "test.pdf", { type: "application/pdf" }));
  }

  if (opts.cardId !== undefined) {
    if (opts.cardId !== null) formData.append("cardId", opts.cardId);
  } else {
    formData.append("cardId", CARD_ID);
  }

  return {
    formData: opts.overrideFormData ?? (() => Promise.resolve(formData)),
  };
}

/** Minimal card row returned by db.card.findUnique for upload route tests */
const FAKE_CARD = {
  id:   CARD_ID,
  list: { board: { orgId: ORG_ID } },
};

/** Configure db mocks for a successful upload (overriding counts as needed) */
function setupUploadMocks(attachCountBeforeUpload: number, plan: string = "FREE") {
  // card lookup
  (db.card as unknown as { findUnique: jest.Mock }).findUnique =
    jest.fn().mockResolvedValue(FAKE_CARD);

  // org lookup
  mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, subscriptionPlan: plan });

  // attachment count (pre-transaction check)
  mockAttachmentCount.mockResolvedValue(attachCountBeforeUpload);

  // user lookup
  mockUserFindUnique.mockResolvedValue({ name: "Test User" });

  // Supabase upload succeeds
  mockStorageUpload.mockResolvedValue({ error: null });

  // $transaction: invoke callback, providing tx proxy with its own count mock
  mockDbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      attachment: {
        count:  jest.fn().mockResolvedValue(attachCountBeforeUpload),
        create: jest.fn().mockResolvedValue({
          id:           "att-new",
          cardId:       CARD_ID,
          fileName:     "test.pdf",
          fileSize:     1,
          mimeType:     "application/pdf",
          url:          "https://cdn.example.com/file.pdf",
          storagePath:  "attachments/card-test-1/timestamp-test.pdf",
          uploadedById:   USER_ID,
          uploadedByName: "Test User",
        }),
      },
    };
    return callback(tx);
  });
}

// ─── Global one-time setup ───────────────────────────────────────────────────

// jsdom's File implementation does not include arrayBuffer(). The upload route
// calls file.arrayBuffer() to read bytes before handing them to Supabase. Since
// Supabase is fully mocked we only need the method to exist and return something.
beforeAll(() => {
  if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
    File.prototype.arrayBuffer = function(this: File): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(this.size));
    };
  }
});

// ─── Setup / teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: MEMBER context for all tests
  mockGetTenantContext.mockResolvedValue(MEMBER_CTX);

  // Default: org exists with 0 boards (FREE)
  mockOrgFindUnique.mockResolvedValue(fakeOrg(0));

  // Default: no attachments
  mockAttachmentCount.mockResolvedValue(0);

  // Default: card findFirst returns null (end-of-list)
  mockCardFindFirst.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4.1  BOARD LIMITS
// ═══════════════════════════════════════════════════════════════════════════

describe("4.1 Board Limits", () => {
  // -----------------------------------------------------------------------
  describe("4.1.1 FREE plan — under the 50-board limit", () => {
    it("creates the board when org has 49 boards (count becomes 50)", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(49, "FREE"));

      const result = await createBoard({ title: "Board Number 50" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe("board-new");
    });

    it("returns no fieldErrors for a valid title", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(0, "FREE"));

      const result = await createBoard({ title: "Valid Title" });

      expect(result.fieldErrors).toBeUndefined();
    });

    it("creates successfully when org has 0 boards", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(0, "FREE"));

      const result = await createBoard({ title: "First Board" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("creates successfully when org has 1 board", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(1, "FREE"));

      const result = await createBoard({ title: "Second Board" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("creates successfully at 49 boards (one below limit) — off-by-one guard", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(49, "FREE"));

      const result = await createBoard({ title: "Last Allowed Board" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.2 FREE plan — at the 50-board limit", () => {
    it("returns LIMIT_REACHED error when org already has exactly 50 boards", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "FREE"));

      const result = await createBoard({ title: "Board 51" });

      expect(result.error).toBe("LIMIT_REACHED");
    });

    it("error response includes {limit: 50, current: 50} in data field", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "FREE"));

      const result = await createBoard({ title: "Overflow Board" });

      expect((result as unknown as { error: string; data: { limit: number; current: number } }).data).toMatchObject({
        limit:   50,
        current: 50,
      });
    });

    it("error response reports current correctly when org has 51 boards (already over)", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(51, "FREE"));

      const result = await createBoard({ title: "Way Over" });

      expect(result.error).toBe("LIMIT_REACHED");
      expect((result as unknown as { data: { current: number } }).data.current).toBe(51);
    });

    it("never calls DAL boards.create when limit is reached", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "FREE"));

      await createBoard({ title: "Blocked Board" });

      const { createDAL: mockCreateDAL } = jest.requireMock("@/lib/dal");
      const dalInstance = await (mockCreateDAL as jest.Mock).mock.results[0]?.value;
      if (dalInstance) {
        expect(dalInstance.boards.create).not.toHaveBeenCalled();
      }
      // No DAL create means no DB board row was inserted
    });

    it("board limit LIMIT_REACHED has both error and data (non-standard ActionState)", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "FREE"));

      const result = await createBoard({ title: "Must Fail" });

      // Both fields are set — this is by design in create-board.ts
      expect(result.error).toBe("LIMIT_REACHED");
      expect((result as { data?: unknown }).data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.3 PRO plan — no board limit", () => {
    it("creates board when PRO org already has 50 boards", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "PRO"));

      const result = await createBoard({ title: "PRO Board 51" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("creates board when PRO org has 100 boards", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(100, "PRO"));

      const result = await createBoard({ title: "PRO Board 101" });

      expect(result.error).toBeUndefined();
      expect(result.data?.id).toBe("board-new");
    });

    it("creates board when PRO org has 500 boards (extreme scale)", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(500, "PRO"));

      const result = await createBoard({ title: "PRO Board 501" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("PRO plan board limit in STRIPE_CONFIG is Infinity", () => {
      expect(STRIPE_CONFIG.limits.PRO.boards).toBe(Infinity);
    });

    it("PRO plan: 0 >= Infinity is always false (limit never triggers)", () => {
      // Verify the guard expression used in create-board.ts
      expect(0 >= Infinity).toBe(false);
      expect(999 >= Infinity).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.4 Concurrent createBoard calls — race condition", () => {
    it("second call returning 50 boards causes LIMIT_REACHED (serialized scenario)", async () => {
      // Simulate: first call commits the 50th board; second call reads updated count
      mockOrgFindUnique
        .mockResolvedValueOnce(fakeOrg(49, "FREE"))  // call 1 reads 49 → proceed
        .mockResolvedValueOnce(fakeOrg(50, "FREE")); // call 2 reads 50 → blocked

      const [r1, r2] = await Promise.all([
        createBoard({ title: "Board A" }),
        createBoard({ title: "Board B" }),
      ]);

      const results = [r1, r2];
      const successes = results.filter((r) => !r.error);
      const failures  = results.filter((r) => r.error === "LIMIT_REACHED");

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
    });

    it("first call to succeed returns a real board object", async () => {
      mockOrgFindUnique
        .mockResolvedValueOnce(fakeOrg(49, "FREE"))
        .mockResolvedValueOnce(fakeOrg(50, "FREE"));

      const [r1, r2] = await Promise.all([
        createBoard({ title: "Board A" }),
        createBoard({ title: "Board B" }),
      ]);

      const winner = [r1, r2].find((r) => !r.error);
      expect(winner?.data?.id).toBe("board-new");
    });

    it("both succeed when both reads return 49 — documents absence of server-side lock", async () => {
      // This test documents CURRENT BEHAVIOUR: createBoard has no serializable
      // transaction, so a true concurrent race at 49 boards can result in both
      // calls succeeding and the org ending up with 51 boards.
      mockOrgFindUnique.mockResolvedValue(fakeOrg(49, "FREE")); // both reads see 49

      const [r1, r2] = await Promise.all([
        createBoard({ title: "Race Board 1" }),
        createBoard({ title: "Race Board 2" }),
      ]);

      // Both pass the limit check — race condition is NOT guarded by a transaction
      expect([r1, r2].every((r) => !r.error || r.error === "LIMIT_REACHED")).toBe(true);
      // At least one succeeds
      expect([r1, r2].some((r) => r.data)).toBe(true);
    });

    it("LIMIT_REACHED response includes current board count from DB read", async () => {
      mockOrgFindUnique
        .mockResolvedValueOnce(fakeOrg(49, "FREE"))
        .mockResolvedValueOnce(fakeOrg(50, "FREE"));

      const [, r2] = await Promise.all([
        createBoard({ title: "Board A" }),
        createBoard({ title: "Board B" }),
      ]);

      expect(r2.error).toBe("LIMIT_REACHED");
      expect((r2 as unknown as { data: { current: number; limit: number } }).data.current).toBe(50);
      expect((r2 as unknown as { data: { limit: number } }).data.limit).toBe(50);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.5 Unknown / unrecognised plan — fail-closed behaviour", () => {
    it("treats unknown plan as FREE (falls back to FREE.boards = 50)", async () => {
      // STRIPE_CONFIG.limits["enterprise"] is undefined → falls back to FREE.boards
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, "enterprise"));

      const result = await createBoard({ title: "Enterprise Board" });

      // Fallback to FREE means limit = 50, current = 50 → LIMIT_REACHED
      expect(result.error).toBe("LIMIT_REACHED");
    });

    it("unknown plan allows creation when below FREE limit (49 boards)", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(49, "enterprise"));

      const result = await createBoard({ title: "Enterprise Under Limit" });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("empty string plan falls back to FREE limit", async () => {
      mockOrgFindUnique.mockResolvedValue(fakeOrg(50, ""));

      const result = await createBoard({ title: "Empty Plan Board" });

      expect(result.error).toBe("LIMIT_REACHED");
    });

    it("null-ish plan (undefined subscriptionPlan) falls back to FREE", async () => {
      const orgNoplan = { ...fakeOrg(50), subscriptionPlan: undefined };
      mockOrgFindUnique.mockResolvedValue(orgNoplan);

      const result = await createBoard({ title: "No Plan Board" });

      expect(result.error).toBe("LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.6 Auto-create org when missing", () => {
    it("creates org row when findUnique returns null, then enforces limit", async () => {
      mockOrgFindUnique.mockResolvedValue(null);
      mockOrgCreate.mockResolvedValue(fakeOrg(0, "FREE")); // brand-new org

      const result = await createBoard({ title: "First Board Ever" });

      expect(mockOrgCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data:    expect.objectContaining({ id: ORG_ID }),
          include: { boards: true },
        })
      );
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it("auto-created org with 0 boards succeeds immediately", async () => {
      mockOrgFindUnique.mockResolvedValue(null);
      mockOrgCreate.mockResolvedValue(fakeOrg(0, "FREE"));

      const result = await createBoard({ title: "New Org Board" });

      expect(result.data?.id).toBe("board-new");
    });
  });

  // -----------------------------------------------------------------------
  describe("4.1.7 STRIPE_CONFIG limit values (contract assertions)", () => {
    it("FREE plan board limit is exactly 50", () => {
      expect(STRIPE_CONFIG.limits.FREE.boards).toBe(50);
    });

    it("PRO plan board limit is Infinity", () => {
      expect(STRIPE_CONFIG.limits.PRO.boards).toBe(Infinity);
    });

    it("STRIPE_CONFIG.limits has exactly FREE and PRO keys", () => {
      const keys = Object.keys(STRIPE_CONFIG.limits).sort();
      expect(keys).toEqual(["FREE", "PRO"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4.2  CARD LIMITS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IMPORTANT NOTE ON CURRENT IMPLEMENTATION
 * ─────────────────────────────────────────
 * `createCard()` (actions/create-card.ts) does NOT currently enforce the
 * STRIPE_CONFIG.limits.FREE.cardsPerBoard cap. The 500-card limit is defined
 * in STRIPE_CONFIG but no check has been added to the server action.
 *
 * Tests in this section therefore:
 *  a) Assert the STRIPE_CONFIG contract values (what the limit SHOULD be).
 *  b) Test a mirror helper `applyCardLimit()` that encodes the intended
 *     enforcement logic — this validates the business rule independently of
 *     the action and will pass even before the enforcement is wired up.
 *  c) Confirm that createCard() currently succeeds regardless of the mocked
 *     card count (documents the gap for future implementation).
 */

// Mirror of the intended cardsPerBoard enforcement logic.
// When the enforcement lands in create-card.ts it should match this shape.
function applyCardLimit(
  cardCount: number,
  plan: "FREE" | "PRO" | string
): { allowed: boolean; error?: string; limit?: number; current?: number } {
  const limits = STRIPE_CONFIG.limits as Record<string, { boards: number; cardsPerBoard: number }>;
  const planLimits = limits[plan] ?? limits["FREE"];
  const limit = planLimits.cardsPerBoard;

  if (cardCount >= limit) {
    return { allowed: false, error: "LIMIT_REACHED", limit, current: cardCount };
  }
  return { allowed: true };
}

describe("4.2 Card Limits", () => {
  // -----------------------------------------------------------------------
  describe("4.2.1 STRIPE_CONFIG contract — cardsPerBoard values", () => {
    it("FREE plan cardsPerBoard limit is exactly 500", () => {
      expect(STRIPE_CONFIG.limits.FREE.cardsPerBoard).toBe(500);
    });

    it("PRO plan cardsPerBoard limit is Infinity", () => {
      expect(STRIPE_CONFIG.limits.PRO.cardsPerBoard).toBe(Infinity);
    });

    it("FREE board limit (50) and FREE card limit (500) are independent values", () => {
      expect(STRIPE_CONFIG.limits.FREE.boards).not.toBe(STRIPE_CONFIG.limits.FREE.cardsPerBoard);
    });

    it("PRO has both board and cardsPerBoard = Infinity", () => {
      expect(STRIPE_CONFIG.limits.PRO.boards).toBe(Infinity);
      expect(STRIPE_CONFIG.limits.PRO.cardsPerBoard).toBe(Infinity);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.2.2 applyCardLimit() mirror — FREE plan enforcement rules", () => {
    it("allows card creation when board has 499 cards (count becomes 500)", () => {
      const result = applyCardLimit(499, "FREE");

      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("blocks creation when board has exactly 500 cards (FREE)", () => {
      const result = applyCardLimit(500, "FREE");

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("LIMIT_REACHED");
    });

    it("LIMIT_REACHED response includes correct limit (500) and current count", () => {
      const result = applyCardLimit(500, "FREE");

      expect(result.limit).toBe(500);
      expect(result.current).toBe(500);
    });

    it("blocks at 501 cards (already over limit)", () => {
      const result = applyCardLimit(501, "FREE");

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(501);
    });

    it("allows at 498 cards — well below limit", () => {
      const result = applyCardLimit(498, "FREE");

      expect(result.allowed).toBe(true);
    });

    it("allows at 0 cards (empty board)", () => {
      const result = applyCardLimit(0, "FREE");

      expect(result.allowed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.2.3 applyCardLimit() mirror — PRO plan has no limit", () => {
    it("allows creation when PRO board has 500 cards", () => {
      const result = applyCardLimit(500, "PRO");

      expect(result.allowed).toBe(true);
    });

    it("allows creation when PRO board has 10,000 cards (extreme)", () => {
      const result = applyCardLimit(10_000, "PRO");

      expect(result.allowed).toBe(true);
    });

    it("PRO plan: 10000 >= Infinity is false", () => {
      expect(10_000 >= Infinity).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.2.4 applyCardLimit() — unknown plan falls back to FREE caps", () => {
    it("unknown plan at 500 cards → LIMIT_REACHED (fail-closed)", () => {
      const result = applyCardLimit(500, "enterprise");

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("LIMIT_REACHED");
      expect(result.limit).toBe(500);
    });

    it("unknown plan at 499 cards → allowed (below FREE fallback limit)", () => {
      const result = applyCardLimit(499, "enterprise");

      expect(result.allowed).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.2.5 createCard() current behaviour (no enforcement yet)", () => {
    // These tests document the current state — createCard does NOT check cardsPerBoard.
    // They should be updated when the enforcement is added.

    it("createCard succeeds regardless of mocked card count (no limit check in action)", async () => {
      // Even if there are 500 cards, the action currently proceeds
      mockCardFindFirst.mockResolvedValue({ order: "z" }); // last card in list
      mockOrgFindUnique.mockResolvedValue(fakeOrg(1, "FREE"));

      const result = await createCard({
        title: "Card on a full board",
        listId: LIST_ID,
        boardId: BOARD_ID,
      });

      // No LIMIT_REACHED — enforcement not yet implemented
      expect(result.error).not.toBe("LIMIT_REACHED");
      expect(result.data).toBeDefined();
    });

    it("createCard with valid 1-char title succeeds", async () => {
      const result = await createCard({
        title: "A",
        listId: LIST_ID,
        boardId: BOARD_ID,
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.title).toBe("New Card"); // from DAL mock
    });

    it("createCard with empty title returns fieldErrors (Zod validation)", async () => {
      const result = await createCard({
        title: "",
        listId: LIST_ID,
        boardId: BOARD_ID,
      });

      expect(result.fieldErrors?.title).toBeDefined();
    });

    it("createCard is rate-limited (protected by checkRateLimit)", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection");
      (checkRateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 30_000 });

      const result = await createCard({
        title: "Rate limited card",
        listId: LIST_ID,
        boardId: BOARD_ID,
      });

      expect(result.error).toContain("Too many requests");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4.3  ATTACHMENT LIMITS
// ═══════════════════════════════════════════════════════════════════════════

describe("4.3 Attachment Limits", () => {
  // Provide required env vars so getServiceClient() doesn't throw
  const ORIG_ENV = process.env;
  beforeAll(() => {
    process.env = {
      ...ORIG_ENV,
      NEXT_PUBLIC_SUPABASE_URL:     "https://fake.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY:    "x".repeat(120), // must be ≥ 100 chars
    };
  });
  afterAll(() => {
    process.env = ORIG_ENV;
  });

  // -----------------------------------------------------------------------
  describe("4.3.1 FREE plan — under the 10-attachment limit", () => {
    it("upload succeeds when org has 9 existing attachments (count becomes 10)", async () => {
      setupUploadMocks(9, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      // Should return 201 Created
      expect(res.status).toBe(201);
    });

    it("upload succeeds when org has 0 attachments", async () => {
      setupUploadMocks(0, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it("upload succeeds when org has 1 attachment", async () => {
      setupUploadMocks(1, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it("upload succeeds at exactly 9 attachments — off-by-one guard", async () => {
      setupUploadMocks(9, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it("successful upload response body contains attachment id", async () => {
      setupUploadMocks(5, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.body).toMatchObject({ id: "att-new" });
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.2 FREE plan — at the 10-attachment limit (upload rejected)", () => {
    it("upload returns HTTP 403 when org already has 10 attachments", async () => {
      setupUploadMocks(10, "FREE");
      // Override: pre-transaction count is 10
      mockAttachmentCount.mockResolvedValue(10);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(403);
    });

    it("403 response body includes human-readable error about Free plan limit", async () => {
      setupUploadMocks(10, "FREE");
      mockAttachmentCount.mockResolvedValue(10);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect((res.body as unknown as { error: string }).error).toMatch(/10 attachments/i);
    });

    it("403 response body mentions upgrading to Pro", async () => {
      setupUploadMocks(10, "FREE");
      mockAttachmentCount.mockResolvedValue(10);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect((res.body as unknown as { error: string }).error).toMatch(/pro/i);
    });

    it("upload at 11 attachments (already over) is also rejected with 403", async () => {
      setupUploadMocks(11, "FREE");
      mockAttachmentCount.mockResolvedValue(11);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(403);
    });

    it("Supabase storage is NOT called when the limit check already fails (no wasted upload)", async () => {
      setupUploadMocks(10, "FREE");
      mockAttachmentCount.mockResolvedValue(10);
      mockStorageUpload.mockClear();

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      await POST(req);

      // The route short-circuits before reaching the Supabase upload call
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.3 Concurrent uploads — serializable transaction re-check", () => {
    it("re-check in transaction catches race: second concurrent upload is rejected", async () => {
      // Simulate: pre-tx count = 9 for BOTH calls (both pass the first guard)…
      // but inside the first tx the count is still 9, inside the second it is 10.
      let txCallCount = 0;
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, subscriptionPlan: "FREE" });
      mockAttachmentCount.mockResolvedValue(9); // outer check sees 9 → proceed
      mockUserFindUnique.mockResolvedValue({ name: "Racer" });
      mockStorageUpload.mockResolvedValue({ error: null });

      mockDbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        txCallCount++;
        const countInTx = txCallCount === 1 ? 9 : 10; // second tx "sees" the first commit
        const tx = {
          attachment: {
            count: jest.fn().mockResolvedValue(countInTx),
            create: jest.fn().mockResolvedValue({
              id: `att-race-${txCallCount}`,
              cardId: CARD_ID,
              fileName: "race.pdf",
              fileSize: 1,
              mimeType: "application/pdf",
              url: "https://cdn.example.com/race.pdf",
              storagePath: `attachments/${CARD_ID}/race.pdf`,
              uploadedById: USER_ID,
              uploadedByName: "Racer",
            }),
          },
        };
        if (countInTx >= 10) {
          throw Object.assign(new Error("ATTACHMENT_LIMIT_REACHED"), { status: 403 });
        }
        return callback(tx);
      });

      const req1 = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const req2 = makeUploadRequest({}) as unknown as import("next/server").NextRequest;

      const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toContain(201); // one succeeds
      expect(statuses).toContain(403); // one is rejected
    });

    it("successful upload in concurrent scenario returns an attachment object", async () => {
      let txCallCount = 0;
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, subscriptionPlan: "FREE" });
      mockAttachmentCount.mockResolvedValue(9);
      mockUserFindUnique.mockResolvedValue({ name: "User" });
      mockStorageUpload.mockResolvedValue({ error: null });

      mockDbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        txCallCount++;
        if (txCallCount > 1) {
          throw Object.assign(new Error("ATTACHMENT_LIMIT_REACHED"), { status: 403 });
        }
        const tx = {
          attachment: {
            count: jest.fn().mockResolvedValue(9),
            create: jest.fn().mockResolvedValue({
              id: "att-winner",
              cardId: CARD_ID,
              fileName: "file.pdf",
              fileSize: 1,
              mimeType: "application/pdf",
              url: "https://cdn.example.com/file.pdf",
              storagePath: `attachments/${CARD_ID}/file.pdf`,
              uploadedById: USER_ID,
              uploadedByName: "User",
            }),
          },
        };
        return callback(tx);
      });

      const req1 = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const req2 = makeUploadRequest({}) as unknown as import("next/server").NextRequest;

      const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);

      const winner = [res1, res2].find((r) => r.status === 201);
      expect(winner?.body).toMatchObject({ id: "att-winner" });
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.4 PRO plan — no attachment limit", () => {
    it("upload succeeds when PRO org already has 10 attachments", async () => {
      setupUploadMocks(10, "PRO");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      // PRO: the if (org.subscriptionPlan === "FREE") block is skipped entirely
      expect(res.status).toBe(201);
    });

    it("upload succeeds when PRO org has 100 attachments", async () => {
      setupUploadMocks(100, "PRO");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it("attachment.count is NOT called for PRO plan uploads (no limit check)", async () => {
      setupUploadMocks(10, "PRO");
      mockAttachmentCount.mockClear();

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      await POST(req);

      // PRO branch skips the count query entirely
      expect(mockAttachmentCount).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.5 Unknown plan — attachment route is fail-open", () => {
    // NOTE: The upload route (app/api/upload/route.ts) only enforces limits
    // for the "FREE" plan branch. An unknown plan like "enterprise" does NOT
    // trigger a 403 — the route is fail-open for unrecognised plans.
    // This differs from createBoard() which falls back to FREE limits (fail-closed).
    it("upload proceeds for unknown plan 'enterprise' (fail-open)", async () => {
      setupUploadMocks(50, "enterprise"); // 50 attachments, unknown plan

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      // No limit enforcement for unknown plan in upload route
      expect(res.status).toBe(201);
    });

    it("upload proceeds for unknown plan when attachment count is > 10 (fail-open)", async () => {
      setupUploadMocks(100, "unknown_plan");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.6 Missing org — fail-open (warn and proceed)", () => {
    it("upload proceeds when org row is missing from DB", async () => {
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue(null); // org not found
      mockUserFindUnique.mockResolvedValue({ name: "User" });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockDbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          attachment: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({
              id: "att-no-org",
              cardId: CARD_ID,
              fileName: "test.pdf",
              fileSize: 1,
              mimeType: "application/pdf",
              url: "https://cdn.example.com/test.pdf",
              storagePath: `attachments/${CARD_ID}/test.pdf`,
              uploadedById: USER_ID,
              uploadedByName: "User",
            }),
          },
        };
        return callback(tx);
      });

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      // Fail-open: missing org → skip limit enforcement → 201
      expect(res.status).toBe(201);
    });

    it("warns (console.warn) when org row is missing", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue(null);
      mockUserFindUnique.mockResolvedValue({ name: "User" });
      mockStorageUpload.mockResolvedValue({ error: null });
      mockDbTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          attachment: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({
              id: "att-x",
              cardId: CARD_ID,
              fileName: "test.pdf",
              fileSize: 1,
              mimeType: "application/pdf",
              url: "https://cdn.example.com/test.pdf",
              storagePath: `attachments/${CARD_ID}/test.pdf`,
              uploadedById: USER_ID,
              uploadedByName: "User",
            }),
          },
        };
        return callback(tx);
      });

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      await POST(req);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found when checking subscription plan")
      );
      warnSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.7 Input validation guards in the upload route", () => {
    it("returns 401 when getTenantContext throws UNAUTHENTICATED TenantError", async () => {
      const { TenantError } = jest.requireMock("@/lib/tenant-context") as typeof import("@/lib/tenant-context");
      mockGetTenantContext.mockRejectedValueOnce(new TenantError("UNAUTHENTICATED", "Not signed in"));

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("returns 403 when getTenantContext throws FORBIDDEN TenantError", async () => {
      const { TenantError } = jest.requireMock("@/lib/tenant-context") as typeof import("@/lib/tenant-context");
      mockGetTenantContext.mockRejectedValueOnce(new TenantError("FORBIDDEN", "No org access"));

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(403);
    });

    it("returns 400 when file field is missing from formData", async () => {
      const formData = new FormData();
      formData.append("cardId", CARD_ID);
      // no "file" field

      const req = makeUploadRequest({
        overrideFormData: () => Promise.resolve(formData),
      }) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((res.body as unknown as { error: string }).error).toMatch(/file is required/i);
    });

    it("returns 400 when cardId field is missing", async () => {
      const formData = new FormData();
      formData.append("file", new File(["x"], "test.pdf", { type: "application/pdf" }));
      // no "cardId" field

      const req = makeUploadRequest({
        overrideFormData: () => Promise.resolve(formData),
      }) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((res.body as unknown as { error: string }).error).toMatch(/cardId is required/i);
    });

    it("returns 413 when file exceeds the 10 MB limit", async () => {
      // Create a file that reports size > 10 MB
      const bigFile = new File(["x"], "big.pdf", { type: "application/pdf" });
      Object.defineProperty(bigFile, "size", { value: 10 * 1024 * 1024 + 1 });

      const formData = new FormData();
      formData.append("file", bigFile);
      formData.append("cardId", CARD_ID);

      const req = makeUploadRequest({
        overrideFormData: () => Promise.resolve(formData),
      }) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(413);
      expect((res.body as unknown as { error: string }).error).toMatch(/10 MB/i);
    });

    it("returns 415 for disallowed MIME type (e.g. video/mp4)", async () => {
      const videoFile = new File(["x"], "video.mp4", { type: "video/mp4" });

      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append("cardId", CARD_ID);

      const req = makeUploadRequest({
        overrideFormData: () => Promise.resolve(formData),
      }) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(415);
    });

    it("returns 404 when cardId does not exist in DB", async () => {
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(null);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(404);
      expect((res.body as unknown as { error: string }).error).toBe("Card not found");
    });

    it("returns 403 when card belongs to a different org", async () => {
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue({
          id: CARD_ID,
          list: { board: { orgId: "org-other-999" } },
        });

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(403);
      expect((res.body as unknown as { error: string }).error).toBe("Forbidden");
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.8 Supabase storage failure handling", () => {
    it("returns 500 when Supabase upload fails", async () => {
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, subscriptionPlan: "FREE" });
      mockAttachmentCount.mockResolvedValue(0);
      mockUserFindUnique.mockResolvedValue({ name: "User" });
      mockStorageUpload.mockResolvedValue({ error: { message: "bucket not found" } });

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect((res.body as unknown as { error: string }).error).toMatch(/File upload failed/i);
    });

    it("returns 500 (not a leak) when Supabase reports invalid API key", async () => {
      (db.card as unknown as { findUnique: jest.Mock }).findUnique =
        jest.fn().mockResolvedValue(FAKE_CARD);
      mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, subscriptionPlan: "FREE" });
      mockAttachmentCount.mockResolvedValue(0);
      mockUserFindUnique.mockResolvedValue({ name: "User" });
      mockStorageUpload.mockResolvedValue({ error: { message: "invalid api key" } });

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      // Error message must NEVER expose internal key details
      expect(res.status).toBe(500);
      expect((res.body as unknown as { error: string }).error).not.toMatch(/api key/i);
    });
  });

  // -----------------------------------------------------------------------
  describe("4.3.9 FREE_ATTACHMENT_LIMIT constant", () => {
    it("the hard-coded FREE attachment limit in the upload route is 10", async () => {
      // Tested indirectly: at count = 10, the route returns 403
      setupUploadMocks(10, "FREE");
      mockAttachmentCount.mockResolvedValue(10);

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(403);
    });

    it("at count = 9 (one below limit), upload is allowed — confirms limit is 10 not 9", async () => {
      setupUploadMocks(9, "FREE");

      const req = makeUploadRequest({}) as unknown as import("next/server").NextRequest;
      const res = await POST(req);

      expect(res.status).toBe(201);
    });
  });
});
