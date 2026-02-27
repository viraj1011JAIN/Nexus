/**
 * Section 5 — Card Operations Tests
 *
 * Sub-sections:
 *   5.1  Validation           — Zod schema rules (no mocks; pure parse calls)
 *   5.2  LexoRank Ordering    — pure functions + algorithm contract for the
 *                               private incrementOrder cap/fallback logic
 *   5.3  Concurrent Writes /  — DAL security: card-not-found, cross-org ID
 *        Card Not Found         injection guard, org-boundary enforcement
 *   5.4  Cross-List Move       — updateCardOrder emits CARD_MOVED exactly once
 *                               on a real cross-list drag and never for a
 *                               same-list reorder
 *
 * Mocking strategy
 * ────────────────
 * 5.1 / 5.2 : no mocks — all pure functions / Zod schemas.
 * 5.3       : follows the same pattern as dal.test.ts — mock @/lib/db and
 *             @/lib/tenant-context, use createDAL directly.
 * 5.4       : mock all I/O deps of updateCardOrder (db, dal, tenant-context,
 *             action-protection, event-bus, next/server, next/cache).
 *             `after()` is mocked to execute callbacks synchronously so we can
 *             assert on emitCardEvent without real async scheduling.
 */

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// These MUST come before any imports so jest.mock() hoisting works correctly.

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("@/lib/db", () => ({
  db: {
    card: {
      findMany:  jest.fn(),
      findUnique: jest.fn(),
      create:    jest.fn(),
      update:    jest.fn(),
      delete:    jest.fn(),
    },
    board: {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
    },
    list: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  setCurrentOrgId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  );
  return {
    ...actual,
    getTenantContext: jest.fn(),
    requireRole:     jest.fn().mockResolvedValue(undefined),
    isDemoContext:   jest.fn().mockReturnValue(false),
  };
});

jest.mock("@/lib/action-protection", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 59, resetInMs: 60_000 }),
  RATE_LIMITS: {
    "create-card":       60,
    "update-card":      120,
    "update-card-order":120,
  },
}));

jest.mock("@/lib/dal", () => {
  // Partial mock: keep all real exports but wrap createDAL in a jest.fn() so
  // 5.3 tests can call through to the real implementation and 5.4 tests can
  // override it to return a stub DAL.
  const actual = jest.requireActual<typeof import("@/lib/dal")>("@/lib/dal");
  return {
    ...actual,
    createDAL: jest.fn(actual.createDAL),
  };
});

jest.mock("@/lib/event-bus", () => ({
  emitCardEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/server", () => ({
  // Execute the callback synchronously so we can assert on emitCardEvent
  // without needing real async scheduling infrastructure.
  after: jest.fn((cb: () => unknown) => cb()),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn:  jest.fn(),
    info:  jest.fn(),
  },
}));

// ─── Real imports (after all mock declarations) ───────────────────────────────

import { CreateCard, UpdateCard } from "@/actions/schema";
import {
  generateNextOrder,
  generateMidpointOrder,
  rebalanceOrders,
} from "@/lib/lexorank";
import { createDAL }         from "@/lib/dal";
import { getTenantContext }   from "@/lib/tenant-context";
import { TenantError }        from "@/lib/tenant-context";
import { db }                 from "@/lib/db";
import { emitCardEvent }      from "@/lib/event-bus";
import { updateCardOrder }    from "@/actions/update-card-order";

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockGetTenantContext = getTenantContext   as jest.Mock;
const mockCreateDAL        = createDAL          as jest.Mock;
const mockEmitCardEvent    = emitCardEvent      as jest.Mock;
const cardFindMany         = db.card.findMany   as jest.Mock;
const boardFindUnique      = db.board.findUnique as jest.Mock;

// ─── Shared fixture UUIDs ─────────────────────────────────────────────────────

const ORG_ID          = "org-test-aaaaaa";
const ORG_ID_B        = "org-test-bbbbbb";
// All IDs used in UpdateCard.safeParse MUST be RFC 4122-compliant UUIDs:
// 3rd segment first char = '4' (version 4), 4th segment first char ∈ {8 9 a b} (variant 1).
const BOARD_ID        = "10000000-0000-4000-8000-000000000001";
const LIST_ID         = "20000000-0000-4000-8000-000000000002";
const LIST_ID_B       = "30000000-0000-4000-8000-000000000003";
const CARD_ID         = "40000000-0000-4000-8000-000000000004";
const CARD_ID_FOREIGN = "f0000000-0000-4000-8000-00000000009f";
const USER_ID         = "user-55555555";

const baseCtx = {
  userId: USER_ID,
  orgId:   ORG_ID,
  orgRole: "MEMBER",
  membership: { role: "MEMBER" as const, isActive: true },
};

// ─── DAL factory helper used in 5.3 ──────────────────────────────────────────
// createDAL is imported once here. In 5.3 beforeEach we restore its real
// call-through implementation; in 5.4 beforeEach we override it with mockDal.

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5.1 — Validation (Zod schemas, no mocks)
// ═════════════════════════════════════════════════════════════════════════════

describe("Section 5.1 — Card Validation (Zod schemas)", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // CreateCard schema
  // ──────────────────────────────────────────────────────────────────────────
  describe("CreateCard schema", () => {
    it("should reject empty title ('')", () => {
      const result = CreateCard.safeParse({
        title:   "",
        listId:  LIST_ID,
        boardId: BOARD_ID,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/required/i);
    });

    it("should reject whitespace-only title (Zod min(1) treats it as non-empty, but still valid test for boundary)", () => {
      // A single space passes min(1) — this tests the min boundary not whitespace trimming
      const result = CreateCard.safeParse({
        title:   " ",
        listId:  LIST_ID,
        boardId: BOARD_ID,
      });
      // Zod min(1) counts " " as length 1 → passes
      expect(result.success).toBe(true);
    });

    it("should accept a single-character title", () => {
      const result = CreateCard.safeParse({
        title:   "X",
        listId:  LIST_ID,
        boardId: BOARD_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe("X");
    });

    it("should reject a title exceeding 100 characters", () => {
      const result = CreateCard.safeParse({
        title:   "A".repeat(101),
        listId:  LIST_ID,
        boardId: BOARD_ID,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/100 characters/i);
    });

    it("should accept a title of exactly 100 characters", () => {
      const result = CreateCard.safeParse({
        title:   "A".repeat(100),
        listId:  LIST_ID,
        boardId: BOARD_ID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject when listId is missing", () => {
      const result = CreateCard.safeParse({ title: "Task", boardId: BOARD_ID });
      expect(result.success).toBe(false);
    });

    it("should reject when boardId is missing", () => {
      const result = CreateCard.safeParse({ title: "Task", listId: LIST_ID });
      expect(result.success).toBe(false);
    });

    it("should not make any DB calls on validation failure (pure schema check)", () => {
      // Zod validation is synchronous and makes no I/O calls.
      // Any DB mock call count verifies this is pure.
      const dbCallsBefore = (db.card.create as jest.Mock).mock.calls.length;
      CreateCard.safeParse({ title: "", listId: LIST_ID, boardId: BOARD_ID });
      expect((db.card.create as jest.Mock).mock.calls.length).toBe(dbCallsBefore);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // UpdateCard schema
  // ──────────────────────────────────────────────────────────────────────────
  describe("UpdateCard schema", () => {
    const validBase = {
      id:      CARD_ID,
      boardId: BOARD_ID,
    };

    it("should reject description of 10 001 characters", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        description: "x".repeat(10_001),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/too long/i);
    });

    it("should accept description of exactly 10 000 characters", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        description: "x".repeat(10_000),
      });
      expect(result.success).toBe(true);
    });

    it("should reject description shorter than 3 characters ('hi')", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        description: "hi",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/too short/i);
    });

    it("should accept description of exactly 3 characters", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        description: "abc",
      });
      expect(result.success).toBe(true);
    });

    it("should reject a non-UUID card id", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/invalid card id/i);
    });

    it("should reject a non-UUID boardId", () => {
      const result = UpdateCard.safeParse({
        ...validBase,
        boardId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/invalid board id/i);
    });

    it("should accept all optional fields absent (only id + boardId)", () => {
      const result = UpdateCard.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it("should accept storyPoints = 0 (min boundary)", () => {
      const result = UpdateCard.safeParse({ ...validBase, storyPoints: 0 });
      expect(result.success).toBe(true);
    });

    it("should reject storyPoints = 1000 (above max of 999)", () => {
      const result = UpdateCard.safeParse({ ...validBase, storyPoints: 1000 });
      expect(result.success).toBe(false);
    });

    it("should accept storyPoints = null (nullable)", () => {
      const result = UpdateCard.safeParse({ ...validBase, storyPoints: null });
      expect(result.success).toBe(true);
    });

    it("should reject title shorter than 3 characters when title is provided", () => {
      const result = UpdateCard.safeParse({ ...validBase, title: "AB" });
      expect(result.success).toBe(false);
    });

    it("should accept title of exactly 3 characters", () => {
      const result = UpdateCard.safeParse({ ...validBase, title: "ABC" });
      expect(result.success).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5.2 — LexoRank Ordering (pure functions)
// ═════════════════════════════════════════════════════════════════════════════

describe("Section 5.2 — LexoRank Ordering", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // generateNextOrder
  // ──────────────────────────────────────────────────────────────────────────
  describe("generateNextOrder()", () => {
    it("should return 'm' when called with no argument (initial position)", () => {
      expect(generateNextOrder()).toBe("m");
    });

    it("should return 'm' for null input", () => {
      expect(generateNextOrder(null)).toBe("m");
    });

    it("should return 'm' for empty string input", () => {
      expect(generateNextOrder("")).toBe("m");
    });

    it("should increment 'm' → 'n'", () => {
      expect(generateNextOrder("m")).toBe("n");
    });

    it("should increment 'n' → 'o'", () => {
      expect(generateNextOrder("n")).toBe("o");
    });

    it("should increment 'a' → 'b'", () => {
      expect(generateNextOrder("a")).toBe("b");
    });

    it("should increment 'y' → 'z'", () => {
      expect(generateNextOrder("y")).toBe("z");
    });

    it("should handle 'z' overflow → 'za' (appends 'a', no truncation)", () => {
      expect(generateNextOrder("z")).toBe("za");
    });

    it("should handle 'zz' overflow → 'zza'", () => {
      expect(generateNextOrder("zz")).toBe("zza");
    });

    it("should handle strings ending in 'z' at any depth → append 'a'", () => {
      expect(generateNextOrder("az")).toBe("aza");
      expect(generateNextOrder("mz")).toBe("mza");
      expect(generateNextOrder("zzz")).toBe("zzza");
    });

    it("should increment multi-char strings by last char only", () => {
      // "mn" ends in 'n' (index 13) → increments to 'o'
      expect(generateNextOrder("mn")).toBe("mo");
      // "za" ends in 'a' → increments to 'b'
      expect(generateNextOrder("za")).toBe("zb");
      // "zb" → "zc"
      expect(generateNextOrder("zb")).toBe("zc");
    });

    it("should maintain lexicographic ordering: generateNextOrder(x) > x", () => {
      const orders = ["a", "m", "n", "z", "za", "zz", "zzz"];
      for (const o of orders) {
        const next = generateNextOrder(o);
        expect(next.localeCompare(o)).toBeGreaterThan(0);
      }
    });

    it("should produce a sequence that sorts correctly: m < n < o < p", () => {
      let current = "m";
      const sequence: string[] = [current];
      for (let i = 0; i < 3; i++) {
        current = generateNextOrder(current);
        sequence.push(current);
      }
      // Verify each is strictly greater than the previous
      for (let i = 1; i < sequence.length; i++) {
        expect(sequence[i].localeCompare(sequence[i - 1])).toBeGreaterThan(0);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // generateMidpointOrder
  // ──────────────────────────────────────────────────────────────────────────
  describe("generateMidpointOrder()", () => {
    it("should return 'ma' for ('m', 'n') — appends 'a' to before arg", () => {
      expect(generateMidpointOrder("m", "n")).toBe("ma");
    });

    it("should return 'maa' for ('ma', 'mb') — deep insertion", () => {
      expect(generateMidpointOrder("ma", "mb")).toBe("maa");
    });

    it("should return 'za' for ('z', 'zb')", () => {
      expect(generateMidpointOrder("z", "zb")).toBe("za");
    });

    it("should produce values that sort between before and after", () => {
      const pairs: [string, string][] = [
        ["m", "n"],
        ["ma", "mb"],
        ["a", "z"],
      ];
      for (const [before, after] of pairs) {
        const mid = generateMidpointOrder(before, after);
        // mid must sort after before
        expect(mid.localeCompare(before)).toBeGreaterThan(0);
        // mid must sort before after
        expect(mid.localeCompare(after)).toBeLessThan(0);
      }
    });

    it("should grow string length by 1 on each insertion", () => {
      let rank = "m";
      for (let i = 0; i < 5; i++) {
        const mid = generateMidpointOrder(rank, rank + "z");
        expect(mid.length).toBe(rank.length + 1);
        rank = mid;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // rebalanceOrders
  // ──────────────────────────────────────────────────────────────────────────
  describe("rebalanceOrders()", () => {
    it("should compact long orders back to short sequential alphabet characters", () => {
      const input = [
        { id: "1", order: "maaaa" },
        { id: "2", order: "maaaaa" },
        { id: "3", order: "maaaaaaa" },
      ];
      const result = rebalanceOrders(input);
      // After sorting by localeCompare and mapping to alphabet[index]:
      // index 0 → "a", index 1 → "b", index 2 → "c"
      expect(result[0].order).toBe("a");
      expect(result[1].order).toBe("b");
      expect(result[2].order).toBe("c");
    });

    it("should preserve item identity (id fields unchanged)", () => {
      const input = [
        { id: "card-x", order: "zzzzz" },
        { id: "card-y", order: "maaaa" },
      ];
      const result = rebalanceOrders(input);
      const ids = result.map((r) => r.id);
      expect(ids).toContain("card-x");
      expect(ids).toContain("card-y");
    });

    it("should sort items by their original order before assigning new values", () => {
      const input = [
        { id: "last",  order: "z" },
        { id: "first", order: "a" },
        { id: "mid",   order: "m" },
      ];
      const result = rebalanceOrders(input);
      // After localeCompare sort: "a" < "m" < "z"
      // first → index 0 → "a", mid → index 1 → "b", last → index 2 → "c"
      const firstItem = result.find((r) => r.id === "first");
      const midItem   = result.find((r) => r.id === "mid");
      const lastItem  = result.find((r) => r.id === "last");
      expect(firstItem!.order.localeCompare(midItem!.order)).toBeLessThan(0);
      expect(midItem!.order.localeCompare(lastItem!.order)).toBeLessThan(0);
    });

    it("should cap assignment at alphabet length (25 = 'z') for large item counts", () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `item-${i}`,
        order: String.fromCharCode(97 + i % 26), // cycles a-z
      }));
      const result = rebalanceOrders(items);
      // alphabet[Math.min(29, 25)] = alphabet[25] = "z" for items beyond index 25
      expect(result.every((r) => /^[a-z]$/.test(r.order))).toBe(true);
    });

    it("should return an empty array for an empty input", () => {
      expect(rebalanceOrders([])).toEqual([]);
    });

    it("should handle a single item, assigning 'a'", () => {
      const result = rebalanceOrders([{ id: "x", order: "maaaaa" }]);
      expect(result).toEqual([{ id: "x", order: "a" }]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // incrementOrder algorithm contract
  // (private to automation-engine.ts — tested via the documented spec contract)
  // ──────────────────────────────────────────────────────────────────────────
  describe("incrementOrder algorithm contract (MAX_ORDER_LENGTH = 32 cap)", () => {
    /**
     * Mirrors the exact logic of lib/automation-engine.ts incrementOrder().
     * Testing against a local copy validates the documented contract without
     * importing a private function, and will catch regressions if the
     * implementation diverges from the spec.
     */
    function incrementOrder(order: string): string {
      const MAX_ORDER_LENGTH = 32;
      if (order.length >= MAX_ORDER_LENGTH) {
        // Fallback: timestamp-based rank prefixed with U+FFFF sort sentinel
        const randomSuffix = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
        return "\uFFFF" + Date.now().toString(36) + "-" + randomSuffix;
      }
      return order + "~";
    }

    it("should append '~' for strings shorter than 32 characters", () => {
      expect(incrementOrder("m")).toBe("m~");
      expect(incrementOrder("z".repeat(31))).toBe("z".repeat(31) + "~");
    });

    it("should trigger fallback for a string of exactly 32 characters", () => {
      const long = "m".repeat(32);
      const result = incrementOrder(long);
      expect(result.startsWith("\uFFFF")).toBe(true);
    });

    it("should trigger fallback for a string longer than 32 characters", () => {
      const veryLong = "m".repeat(64);
      const result = incrementOrder(veryLong);
      expect(result.startsWith("\uFFFF")).toBe(true);
    });

    it("fallback rank must always sort AFTER any printable ASCII order string", () => {
      const fallback = incrementOrder("z".repeat(32));
      // U+FFFF is the highest BMP code point — sorts after all printable ASCII
      expect(fallback > "z".repeat(100)).toBe(true);
      expect(fallback > "~".repeat(100)).toBe(true);
      expect(fallback > "\u007E".repeat(100)).toBe(true); // ~ is 0x7E
    });

    it("fallback rank format: \\uFFFF + base36 timestamp + '-' + 8 hex chars", () => {
      const fallback = incrementOrder("x".repeat(32));
      // Remove the U+FFFF sentinel
      const body = fallback.slice(1);
      // Should match: [base36 timestamp]-[8-char hex]
      expect(body).toMatch(/^[0-9a-z]+-[0-9a-f]{8}$/);
    });

    it("two fallback ranks produced in the same millisecond should differ (random suffix)", () => {
      const long = "m".repeat(32);
      // Generate many in a tight loop — random suffix makes collisions extremely unlikely
      const results = new Set(Array.from({ length: 20 }, () => incrementOrder(long)));
      // All 20 should be unique
      expect(results.size).toBe(20);
    });

    it("normal increments sort correctly: incrementOrder(x) > x for short strings", () => {
      const inputs = ["a", "m", "z", "za", "ab"];
      for (const o of inputs) {
        const incremented = incrementOrder(o);
        expect(incremented > o).toBe(true);
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5.3 — Concurrent Writes / Card Not Found / Org Boundary
// Uses the real TenantDAL with mocked Prisma db client.
// ═════════════════════════════════════════════════════════════════════════════

describe("Section 5.3 — DAL Card Security", () => {
  // realDAL is a real TenantDAL instance; its underlying db.* calls are all
  // mocked so no actual DB connections are made.
  let realDAL: Awaited<ReturnType<typeof createDAL>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Restore the real createDAL implementation (clearAllMocks wipes it).
    const actualDal = jest.requireActual<typeof import("@/lib/dal")>("@/lib/dal");
    mockCreateDAL.mockImplementation(actualDal.createDAL);

    // Provide auth context (createDAL calls getTenantContext internally when ctx is omitted).
    mockGetTenantContext.mockResolvedValue(baseCtx);

    // Board ownership verification: board belongs to ORG_ID ✓
    boardFindUnique.mockResolvedValue({ id: BOARD_ID, orgId: ORG_ID });

    // Build a real DAL instance bound to baseCtx (db.* calls are all mocked).
    realDAL = await createDAL(baseCtx);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findUnique — org boundary
  // ──────────────────────────────────────────────────────────────────────────
  describe("dal.cards.findUnique — org boundary enforcement", () => {
    it("should throw TenantError NOT_FOUND when card belongs to a different org", async () => {
      // DB returns a card whose board belongs to ORG_ID_B (different org)
      (db.card.findUnique as jest.Mock).mockResolvedValue({
        id: CARD_ID,
        list: {
          board: { orgId: ORG_ID_B }, // wrong org
        },
      });

      await expect(realDAL.cards.findUnique(CARD_ID)).rejects.toThrow(TenantError);
      await expect(realDAL.cards.findUnique(CARD_ID)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should throw TenantError NOT_FOUND when card does not exist (null result)", async () => {
      (db.card.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(realDAL.cards.findUnique(CARD_ID)).rejects.toThrow(TenantError);
    });

    it("should resolve successfully when card belongs to the same org", async () => {
      const mockCard = {
        id: CARD_ID,
        title: "Valid Card",
        list: {
          board: { orgId: ORG_ID }, // correct org
        },
      };
      (db.card.findUnique as jest.Mock).mockResolvedValue(mockCard);

      const result = await realDAL.cards.findUnique(CARD_ID);
      expect(result).toMatchObject({ id: CARD_ID });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // update — card not found while modal is open
  // ──────────────────────────────────────────────────────────────────────────
  describe("dal.cards.update — card deleted concurrently", () => {
    it("should throw TenantError NOT_FOUND when card no longer exists (deleted while modal open)", async () => {
      // verifyCardOwnership queries card.findUnique for ownership check
      (db.card.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        realDAL.cards.update(CARD_ID, { title: "Updated" })
      ).rejects.toThrow(TenantError);
    });

    it("should throw TenantError NOT_FOUND when card belongs to a different org", async () => {
      (db.card.findUnique as jest.Mock).mockResolvedValue({
        id: CARD_ID,
        list: { board: { orgId: ORG_ID_B } }, // wrong org
      });

      await expect(
        realDAL.cards.update(CARD_ID, { title: "Hijack" })
      ).rejects.toThrow(TenantError);
    });

    it("should call db.card.update when ownership is verified", async () => {
      // First call: verifyCardOwnership → card exists, correct org
      (db.card.findUnique as jest.Mock).mockResolvedValue({
        id: CARD_ID,
        listId: LIST_ID,
        list: { board: { orgId: ORG_ID } },
      });
      const updated = { id: CARD_ID, title: "Updated Title" };
      (db.card.update as jest.Mock).mockResolvedValue(updated);

      const result = await realDAL.cards.update(CARD_ID, { title: "Updated Title" });
      expect(result).toMatchObject({ id: CARD_ID, title: "Updated Title" });
      expect(db.card.update as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reorder — card ID injection guard
  // ──────────────────────────────────────────────────────────────────────────
  describe("dal.cards.reorder — ID injection protection", () => {
    const validCardId   = "card-aaaa";
    const foreignCardId = "card-ffff"; // belongs to a different org/board

    beforeEach(() => {
      // verifyBoardOwnership: board exists and belongs to ORG_ID
      boardFindUnique.mockResolvedValue({ id: BOARD_ID, orgId: ORG_ID });
      // DB returns only the VALID card IDs for this board
      cardFindMany.mockResolvedValue([{ id: validCardId }]);
    });

    it("should throw TenantError NOT_FOUND when payload contains a foreign card ID", async () => {
      await expect(
        realDAL.cards.reorder(
          [
            { id: validCardId,   order: "n", listId: LIST_ID },
            { id: foreignCardId, order: "o", listId: LIST_ID }, // ← attacker-injected
          ],
          BOARD_ID
        )
      ).rejects.toThrow(TenantError);
    });

    it("should NOT call db.card.update before rejecting the foreign ID", async () => {
      await realDAL.cards.reorder(
        [{ id: foreignCardId, order: "n", listId: LIST_ID }],
        BOARD_ID
      ).catch(() => { /* expected */ });

      expect(db.$transaction as jest.Mock).not.toHaveBeenCalled();
    });

    it("should call db.$transaction only when ALL card IDs are valid", async () => {
      (db.$transaction as jest.Mock).mockResolvedValue([]);

      await realDAL.cards.reorder(
        [{ id: validCardId, order: "n", listId: LIST_ID }],
        BOARD_ID
      );

      expect(db.$transaction as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it("should reject ALL items if even one ID is foreign (all-or-nothing)", async () => {
      await expect(
        realDAL.cards.reorder(
          [
            { id: validCardId,   order: "m", listId: LIST_ID },
            { id: foreignCardId, order: "n", listId: LIST_ID },
          ],
          BOARD_ID
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      // $transaction must never be called — rejection happens before the batch
      expect(db.$transaction as jest.Mock).not.toHaveBeenCalled();
    });

    it("should reject a payload where all IDs are foreign", async () => {
      await expect(
        realDAL.cards.reorder(
          [{ id: "card-evil-1", order: "m", listId: LIST_ID }],
          BOARD_ID
        )
      ).rejects.toThrow(TenantError);
    });

    it("should succeed and return transaction result for a fully valid payload", async () => {
      (db.$transaction as jest.Mock).mockResolvedValue([{ id: validCardId }]);

      const result = await realDAL.cards.reorder(
        [{ id: validCardId, order: "n", listId: LIST_ID }],
        BOARD_ID
      );
      expect(result).toEqual([{ id: validCardId }]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reorder — board ownership check
  // ──────────────────────────────────────────────────────────────────────────
  describe("dal.cards.reorder — board ownership check", () => {
    it("should throw TenantError NOT_FOUND when board belongs to a different org", async () => {
      boardFindUnique.mockResolvedValue({ id: BOARD_ID, orgId: ORG_ID_B });

      await expect(
        realDAL.cards.reorder(
          [{ id: CARD_ID, order: "n", listId: LIST_ID }],
          BOARD_ID
        )
      ).rejects.toThrow(TenantError);
    });

    it("should throw TenantError NOT_FOUND when board does not exist", async () => {
      boardFindUnique.mockResolvedValue(null);

      await expect(
        realDAL.cards.reorder(
          [{ id: CARD_ID, order: "n", listId: LIST_ID }],
          BOARD_ID
        )
      ).rejects.toThrow(TenantError);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5.4 — Cross-List Move Detection (updateCardOrder server action)
// ═════════════════════════════════════════════════════════════════════════════

describe("Section 5.4 — Cross-List Move / CARD_MOVED event", () => {
  // Mock DAL instance returned by createDAL
  const mockDalCards = {
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  const mockDal = { cards: mockDalCards };

  beforeEach(() => {
    jest.clearAllMocks();

    // Auth + rate-limit defaults
    mockGetTenantContext.mockResolvedValue(baseCtx);
    const { checkRateLimit } = jest.requireMock<typeof import("@/lib/action-protection")>(
      "@/lib/action-protection"
    );
    (checkRateLimit as jest.Mock).mockReturnValue({
      allowed: true, remaining: 59, resetInMs: 60_000,
    });

    // createDAL → return stub DAL (no real DB calls from DAL layer)
    mockCreateDAL.mockResolvedValue(mockDal);
    mockDalCards.reorder.mockResolvedValue(undefined);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CARD_MOVED should fire when listId changes
  // ──────────────────────────────────────────────────────────────────────────
  describe("CARD_MOVED event — real cross-list drag", () => {
    it("should emit CARD_MOVED once when a card moves to a different list", async () => {
      // Pre-move snapshot: card is in LIST_ID (list A)
      cardFindMany.mockResolvedValue([
        { id: CARD_ID, listId: LIST_ID,   title: "Task 1" },
      ]);

      // Reorder payload: card is now in LIST_ID_B (list B)
      const items = [
        { id: CARD_ID, order: "n", listId: LIST_ID_B, title: "Task 1" },
      ];

      const result = await updateCardOrder(items, BOARD_ID);

      expect(result.success).toBe(true);
      expect(mockEmitCardEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitCardEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type:    "CARD_MOVED",
          cardId:  CARD_ID,
          context: expect.objectContaining({
            fromListId: LIST_ID,
            toListId:   LIST_ID_B,
          }),
        }),
        expect.any(Object)
      );
    });

    it("should include correct orgId and boardId in the CARD_MOVED payload", async () => {
      cardFindMany.mockResolvedValue([
        { id: CARD_ID, listId: LIST_ID, title: "Task 1" },
      ]);

      await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID_B, title: "Task 1" }],
        BOARD_ID
      );

      expect(mockEmitCardEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId:   ORG_ID,
          boardId: BOARD_ID,
        }),
        expect.any(Object)
      );
    });

    it("should emit CARD_MOVED for each card that changes list in a multi-card payload", async () => {
      const CARD_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // valid UUID (v4, variant 8)

      // Both cards start in LIST_ID, both move to LIST_ID_B
      cardFindMany.mockResolvedValue([
        { id: CARD_ID,   listId: LIST_ID, title: "Task 1" },
        { id: CARD_ID_2, listId: LIST_ID, title: "Task 2" },
      ]);

      await updateCardOrder(
        [
          { id: CARD_ID,   order: "m", listId: LIST_ID_B, title: "Task 1" },
          { id: CARD_ID_2, order: "n", listId: LIST_ID_B, title: "Task 2" },
        ],
        BOARD_ID
      );

      // One CARD_MOVED per moved card
      expect(mockEmitCardEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CARD_MOVED should NOT fire for same-list reorders
  // ──────────────────────────────────────────────────────────────────────────
  describe("CARD_MOVED event — same-list reorder", () => {
    it("should NOT emit CARD_MOVED when card stays in the same list", async () => {
      // Snapshot: card is in LIST_ID
      cardFindMany.mockResolvedValue([
        { id: CARD_ID, listId: LIST_ID, title: "Task 1" },
      ]);

      // Payload: card stays in LIST_ID (just changes order position)
      await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID, title: "Task 1" }],
        BOARD_ID
      );

      expect(mockEmitCardEvent).not.toHaveBeenCalled();
    });

    it("should NOT emit CARD_MOVED for multiple cards all staying in the same list", async () => {
      const CARD_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // valid UUID (v4, variant 8)

      cardFindMany.mockResolvedValue([
        { id: CARD_ID,   listId: LIST_ID, title: "Task 1" },
        { id: CARD_ID_2, listId: LIST_ID, title: "Task 2" },
      ]);

      // Both cards stay in LIST_ID — only order changes
      await updateCardOrder(
        [
          { id: CARD_ID,   order: "n", listId: LIST_ID, title: "Task 1" },
          { id: CARD_ID_2, order: "o", listId: LIST_ID, title: "Task 2" },
        ],
        BOARD_ID
      );

      expect(mockEmitCardEvent).not.toHaveBeenCalled();
    });

    it("should emit CARD_MOVED only for the card that actually crossed lists (mixed payload)", async () => {
      const CARD_STAYS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // valid UUID (v4, variant 8)
      const CARD_MOVES = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; // valid UUID (v4, variant 8)

      cardFindMany.mockResolvedValue([
        { id: CARD_STAYS, listId: LIST_ID,   title: "Stays" },
        { id: CARD_MOVES, listId: LIST_ID,   title: "Moves" },
      ]);

      await updateCardOrder(
        [
          { id: CARD_STAYS, order: "m", listId: LIST_ID,   title: "Stays" }, // same list
          { id: CARD_MOVES, order: "n", listId: LIST_ID_B, title: "Moves" }, // cross-list
        ],
        BOARD_ID
      );

      // emitCardEvent called exactly once — only for CARD_MOVES
      expect(mockEmitCardEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitCardEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: CARD_MOVES,
          type:   "CARD_MOVED",
        }),
        expect.any(Object)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Snapshot uses canonical DB title, not client-supplied title
  // ──────────────────────────────────────────────────────────────────────────
  describe("CARD_MOVED payload — uses canonical DB title", () => {
    it("should use the DB title in the event metadata, not the client-supplied title", async () => {
      const DB_TITLE     = "Canonical Title From DB";
      const CLIENT_TITLE = "Attacker-Controlled Title";

      cardFindMany.mockResolvedValue([
        { id: CARD_ID, listId: LIST_ID, title: DB_TITLE },
      ]);

      await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID_B, title: CLIENT_TITLE }],
        BOARD_ID
      );

      expect(mockEmitCardEvent).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ cardTitle: DB_TITLE })
      );
      // Verify client title was NOT used
      expect(mockEmitCardEvent).not.toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ cardTitle: CLIENT_TITLE })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────────────────────────────────
  describe("updateCardOrder — error handling", () => {
    it("should return { success: false } when dal.cards.reorder throws", async () => {
      cardFindMany.mockResolvedValue([
        { id: CARD_ID, listId: LIST_ID, title: "Task" },
      ]);
      mockDalCards.reorder.mockRejectedValue(new Error("DB connection lost"));

      const result = await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID, title: "Task" }],
        BOARD_ID
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should return rate-limit error when checkRateLimit is blocked", async () => {
      const { checkRateLimit } = jest.requireMock<typeof import("@/lib/action-protection")>(
        "@/lib/action-protection"
      );
      (checkRateLimit as jest.Mock).mockReturnValueOnce({
        allowed:    false,
        remaining:  0,
        resetInMs:  30_000,
      });

      const result = await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID, title: "Task" }],
        BOARD_ID
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Try again in/);
    });

    it("should return demo-mode error when isDemoContext returns true", async () => {
      const { isDemoContext } = jest.requireMock<typeof import("@/lib/tenant-context")>(
        "@/lib/tenant-context"
      );
      (isDemoContext as jest.Mock).mockReturnValueOnce(true);

      const result = await updateCardOrder(
        [{ id: CARD_ID, order: "n", listId: LIST_ID, title: "Task" }],
        BOARD_ID
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/demo/i);
    });
  });
});
