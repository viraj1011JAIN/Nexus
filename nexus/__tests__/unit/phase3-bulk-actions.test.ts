/**
 * TASK-031 — Unit tests: bulk-card-actions (bulk operations)
 *
 * Actual signatures (in actions/bulk-card-actions.ts):
 *   bulkUpdateCards(cardIds, update)
 *   bulkDeleteCards(cardIds)
 *   bulkMoveCards(cardIds, targetListId)
 */

import { bulkUpdateCards, bulkDeleteCards, bulkMoveCards } from "@/actions/bulk-card-actions";
import { db } from "@/lib/db";

const CARD_IDS    = [
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
];
const LIST_ID     = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const BOARD_ID    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Minimal mock tx object for transaction callbacks
const mockTx = {
  card: {
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    update:     jest.fn().mockResolvedValue({}),
  },
  cardLabelAssignment: {
    upsert: jest.fn().mockResolvedValue({}),
  },
};

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId:  "org_1",
    orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  }),
  requireRole:      jest.fn().mockResolvedValue(undefined),
  isDemoContext:    jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    card: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
    },
    list: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

describe("bulk-card-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const { getTenantContext, requireRole, isDemoContext } = jest.requireMock("@/lib/tenant-context") as {
      getTenantContext: jest.Mock; requireRole: jest.Mock; isDemoContext: jest.Mock;
    };
    getTenantContext.mockResolvedValue({
      userId: "user_1", orgId: "org_1", orgRole: "org:member",
      membership: { role: "MEMBER", isActive: true },
    });
    requireRole.mockResolvedValue(undefined);
    isDemoContext.mockReturnValue(false);

    mockTx.card.updateMany.mockResolvedValue({ count: 2 });
    mockTx.card.update.mockResolvedValue({});
    mockTx.cardLabelAssignment.upsert.mockResolvedValue({});

    // Default: ownership check + board-ID lookups both return usable shapes
    (db.card.findMany as jest.Mock).mockResolvedValue(
      CARD_IDS.map((id) => ({ id, list: { boardId: BOARD_ID } }))
    );

    // Default: transaction executes callback with mockTx, or resolves array
    (db.$transaction as jest.Mock).mockImplementation((arg: unknown) => {
      if (typeof arg === "function") return arg(mockTx);
      if (Array.isArray(arg)) return Promise.all(arg);
      return Promise.resolve();
    });
  });

  describe("bulkUpdateCards", () => {
    it("updates priority for multiple cards", async () => {
      mockTx.card.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await bulkUpdateCards(CARD_IDS, { priority: "HIGH" });
      expect(result.error).toBeUndefined();
    });

    it("returns error with empty cardIds array", async () => {
      const result = await bulkUpdateCards([], { priority: "HIGH" });
      expect(result.error).toBeDefined();
    });
  });

  describe("bulkDeleteCards", () => {
    it("deletes specified cards", async () => {
      (db.card.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 2 });

      const result = await bulkDeleteCards(CARD_IDS);
      expect(result.error).toBeUndefined();
      expect(db.card.deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("bulkMoveCards", () => {
    it("moves cards to a target list", async () => {
      (db.list.findFirst as jest.Mock).mockResolvedValueOnce({
        id: LIST_ID, boardId: BOARD_ID, board: { orgId: "org_1" },
      });

      const result = await bulkMoveCards(CARD_IDS, LIST_ID);
      expect(result.error).toBeUndefined();
    });

    it("returns error if target list not found", async () => {
      (db.list.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await bulkMoveCards(CARD_IDS, "ffffffff-ffff-4fff-8fff-ffffffffffff");
      expect(result.error).toBeDefined();
    });
  });
});
