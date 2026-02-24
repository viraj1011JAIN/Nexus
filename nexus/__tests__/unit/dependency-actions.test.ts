/**
 * TASK-031 — Unit tests: dependency-actions
 *
 * Covers: getCardDependencies, addCardDependency, removeCardDependency
 */

import { getCardDependencies, addCardDependency, removeCardDependency } from "@/actions/dependency-actions";
import { db } from "@/lib/db";

const CARD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CARD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DEP_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOARD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId:  "org_1",
    orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  }),
  requireRole:   jest.fn().mockResolvedValue(undefined),
  isDemoContext: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    cardDependency: {
      findMany: jest.fn(),
      upsert:   jest.fn(),
      findFirst: jest.fn(),
      delete:    jest.fn(),
    },
    card: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// ─── Helpers to restore mocks ─────────────────────────────────────────────────

function resetMocks() {
  const { getTenantContext, requireRole, isDemoContext } =
    jest.requireMock("@/lib/tenant-context") as {
      getTenantContext: jest.Mock;
      requireRole: jest.Mock;
      isDemoContext: jest.Mock;
    };
  getTenantContext.mockResolvedValue({
    userId: "user_1", orgId: "org_1", orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  });
  requireRole.mockResolvedValue(undefined);
  isDemoContext.mockReturnValue(false);
}

describe("dependency-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  // ─── getCardDependencies ────────────────────────────────────────────────────

  describe("getCardDependencies", () => {
    it("returns blocking and blockedBy lists on success", async () => {
      (db.cardDependency.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: DEP_ID, blocked: { id: CARD_B, title: "Blocked card" } }])
        .mockResolvedValueOnce([]);

      const result = await getCardDependencies(CARD_A);
      expect(result.error).toBeUndefined();
      expect(result.data?.blocking).toHaveLength(1);
      expect(result.data?.blockedBy).toHaveLength(0);
    });

    it("returns error when tenant context throws", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("tenant context failure"));

      const result = await getCardDependencies(CARD_A);
      expect(result.error).toBeDefined();
    });
  });

  // ─── addCardDependency ──────────────────────────────────────────────────────

  describe("addCardDependency", () => {
    const validInput = {
      blockerId: CARD_A,
      blockedId: CARD_B,
      type: "BLOCKS" as const,
      boardId: BOARD_ID,
    };

    it("returns error when a card depends on itself", async () => {
      const result = await addCardDependency({
        blockerId: CARD_A,
        blockedId: CARD_A,
        type: "BLOCKS",
        boardId: BOARD_ID,
      });
      expect(result.error).toMatch(/cannot depend on itself/i);
    });

    it("returns error when input fails Zod validation", async () => {
      const result = await addCardDependency({
        blockerId: "not-a-uuid",
        blockedId: CARD_B,
        type: "BLOCKS" as const,
        boardId: BOARD_ID,
      });
      expect(result.error).toBeDefined();
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);

      (db.card.findFirst as jest.Mock).mockResolvedValue({ id: CARD_A, title: "A" });
      const result = await addCardDependency(validInput);
      expect(result.error).toBeDefined();
    });

    it("creates dependency when cards are accessible and no cycle", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValue({ id: CARD_A, title: "A" });
      // BFS: no existing edges from CARD_B → no cycle
      (db.cardDependency.findMany as jest.Mock).mockResolvedValueOnce([]);
      (db.cardDependency.upsert as jest.Mock).mockResolvedValueOnce({
        id: DEP_ID, blockerId: CARD_A, blockedId: CARD_B, type: "BLOCKS",
      });

      const result = await addCardDependency(validInput);
      expect(result.error).toBeUndefined();
      expect(db.cardDependency.upsert).toHaveBeenCalledTimes(1);
    });

    it("returns error when adding would create a cycle", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValue({ id: CARD_A, title: "A" });
      // BFS returns CARD_A as reachable from CARD_B → cycle detected
      (db.cardDependency.findMany as jest.Mock).mockResolvedValueOnce([
        { blockedId: CARD_A },
      ]);

      const result = await addCardDependency(validInput);
      expect(result.error).toMatch(/circular/i);
    });

    it("allows RELATES_TO without cycle check", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValue({ id: CARD_A, title: "A" });
      (db.cardDependency.upsert as jest.Mock).mockResolvedValueOnce({
        id: DEP_ID, blockerId: CARD_A, blockedId: CARD_B, type: "RELATES_TO",
      });

      const result = await addCardDependency({ ...validInput, type: "RELATES_TO" });
      expect(result.error).toBeUndefined();
      // findMany (BFS) should NOT have been called for non-BLOCKS types
      expect(db.cardDependency.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── removeCardDependency ───────────────────────────────────────────────────

  describe("removeCardDependency", () => {
    it("returns error when dependency not found", async () => {
      (db.cardDependency.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await removeCardDependency({ id: DEP_ID });
      expect(result.error).toBeDefined();
    });

    it("deletes dependency when found", async () => {
      (db.cardDependency.findFirst as jest.Mock).mockResolvedValueOnce({ id: DEP_ID });
      (db.cardDependency.delete as jest.Mock).mockResolvedValueOnce({ id: DEP_ID });

      const result = await removeCardDependency({ id: DEP_ID });
      expect(result.error).toBeUndefined();
      expect(db.cardDependency.delete).toHaveBeenCalledWith({ where: { id: DEP_ID } });
    });

    it("returns error when input fails Zod validation", async () => {
      const result = await removeCardDependency({ id: "not-a-uuid" });
      expect(result.error).toBeDefined();
    });
  });
});
