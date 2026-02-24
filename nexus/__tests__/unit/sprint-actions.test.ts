/**
 * TASK-031 — Unit tests: sprint-actions
 *
 * Actual signatures:
 *   createSprint(boardId, name, goal?, startDate?, endDate?)
 *   completeSprint(sprintId)
 */

import { createSprint, completeSprint } from "@/actions/sprint-actions";
import { db } from "@/lib/db";

const BOARD_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SPRINT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId: "org_1",
    orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  }),
  requireRole:      jest.fn().mockResolvedValue(undefined),
  isDemoContext:    jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    board: {
      findFirst: jest.fn(),
    },
    sprint: {
      create:    jest.fn(),
      findFirst: jest.fn(),
      update:    jest.fn(),
    },
    card: { updateMany: jest.fn() },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

describe("sprint-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish tenant-context mock after clearAllMocks
    const { getTenantContext, requireRole, isDemoContext } = jest.requireMock("@/lib/tenant-context") as {
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
  });

  describe("createSprint", () => {
    it("returns an error when name is empty", async () => {
      const result = await createSprint(BOARD_ID, "");
      expect(result.error).toBeDefined();
    });

    it("creates a sprint with valid data", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.sprint.create as jest.Mock).mockResolvedValueOnce({
        id: SPRINT_ID, name: "Sprint 1", boardId: BOARD_ID,
        goal: "Ship feature X", status: "PLANNING",
      });

      const result = await createSprint(
        BOARD_ID,
        "Sprint 1",
        "Ship feature X",
        new Date().toISOString(),
        new Date(Date.now() + 86400000 * 14).toISOString(),
      );

      expect(result.error).toBeUndefined();
      expect(db.sprint.create).toHaveBeenCalledTimes(1);
    });

    it("returns error when board not found", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await createSprint(BOARD_ID, "Sprint X");
      expect(result.error).toBeDefined();
    });
  });

  describe("completeSprint", () => {
    it("returns error if sprint not found", async () => {
      (db.sprint.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await completeSprint(SPRINT_ID);
      expect(result.error).toBeDefined();
    });

    it("marks sprint as completed", async () => {
      const mockSprint = { id: SPRINT_ID, boardId: BOARD_ID, status: "ACTIVE", cards: [] };
      (db.sprint.findFirst as jest.Mock).mockResolvedValueOnce(mockSprint);
      (db.sprint.update as jest.Mock).mockResolvedValueOnce({ ...mockSprint, status: "COMPLETED" });
      (db.card.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });

      const result = await completeSprint(SPRINT_ID);
      expect(result.error).toBeUndefined();
      expect(db.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SPRINT_ID } })
      );
    });
  });
});

