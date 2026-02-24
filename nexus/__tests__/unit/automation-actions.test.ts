/**
 * TASK-031 — Unit tests: automation-actions
 *
 * Covers: getAutomations, createAutomation, updateAutomation, deleteAutomation
 */

import {
  getAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from "@/actions/automation-actions";
import { db } from "@/lib/db";

const BOARD_ID      = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTOMATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LIST_ID       = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId:  "org_1",
    orgRole: "org:admin",
    membership: { role: "ADMIN", isActive: true },
  }),
  requireRole:   jest.fn().mockResolvedValue(undefined),
  isDemoContext: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    automation: {
      findMany:  jest.fn(),
      create:    jest.fn(),
      findFirst: jest.fn(),
      update:    jest.fn(),
      delete:    jest.fn(),
    },
    board: {
      findFirst: jest.fn(),
    },
    automationLog: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function resetMocks() {
  const { getTenantContext, requireRole, isDemoContext } = jest.requireMock("@/lib/tenant-context") as {
    getTenantContext: jest.Mock; requireRole: jest.Mock; isDemoContext: jest.Mock;
  };
  getTenantContext.mockResolvedValue({
    userId: "user_1", orgId: "org_1", orgRole: "org:admin",
    membership: { role: "ADMIN", isActive: true },
  });
  requireRole.mockResolvedValue(undefined);
  isDemoContext.mockReturnValue(false);
}

describe("automation-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getAutomations ──────────────────────────────────────────────────────

  describe("getAutomations", () => {
    it("returns automations scoped to org", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValueOnce([
        { id: AUTOMATION_ID, name: "Move to done", isEnabled: true },
      ]);
      const result = await getAutomations();
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(1);
    });

    it("filters by boardId when provided", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValueOnce([]);
      await getAutomations(BOARD_ID);
      expect(db.automation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: "org_1", boardId: BOARD_ID }),
        })
      );
    });

    it("returns error on failure", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("DB error"));
      const result = await getAutomations();
      expect(result.error).toBeDefined();
    });
  });

  // ─── createAutomation ────────────────────────────────────────────────────

  describe("createAutomation", () => {
    const validInput = {
      boardId: BOARD_ID,
      name: "Auto move to Done",
      trigger: { type: "CARD_MOVED" as const, listId: LIST_ID },
      conditions: [],
      actions: [{ type: "SET_PRIORITY" as const, priority: "LOW" as const }],
    };

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createAutomation(validInput);
      expect(result.error).toBeDefined();
    });

    it("returns error when name is empty", async () => {
      const result = await createAutomation({ ...validInput, name: "" });
      expect(result.error).toBeDefined();
    });

    it("returns error when actions array is empty", async () => {
      const result = await createAutomation({ ...validInput, actions: [] });
      expect(result.error).toBeDefined();
    });

    it("returns error when referenced board not found", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await createAutomation(validInput);
      expect(result.error).toMatch(/Board not found/i);
    });

    it("creates automation when board is found", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.automation.create as jest.Mock).mockResolvedValueOnce({
        id: AUTOMATION_ID, ...validInput, orgId: "org_1",
      });
      const result = await createAutomation(validInput);
      expect(result.error).toBeUndefined();
      expect(db.automation.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateAutomation ────────────────────────────────────────────────────

  describe("updateAutomation", () => {
    it("returns error when automation not found", async () => {
      (db.automation.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await updateAutomation(AUTOMATION_ID, { isEnabled: false });
      expect(result.error).toBeDefined();
    });

    it("updates automation when found", async () => {
      (db.automation.findFirst as jest.Mock).mockResolvedValueOnce({ id: AUTOMATION_ID, orgId: "org_1" });
      (db.automation.update as jest.Mock).mockResolvedValueOnce({ id: AUTOMATION_ID, isEnabled: false });
      const result = await updateAutomation(AUTOMATION_ID, { isEnabled: false });
      expect(result.error).toBeUndefined();
    });
  });

  // ─── deleteAutomation ────────────────────────────────────────────────────

  describe("deleteAutomation", () => {
    it("returns error when automation not found", async () => {
      (db.automation.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await deleteAutomation(AUTOMATION_ID);
      expect(result.error).toBeDefined();
    });

    it("deletes automation when found", async () => {
      (db.automation.findFirst as jest.Mock).mockResolvedValueOnce({ id: AUTOMATION_ID, orgId: "org_1" });
      (db.automation.delete as jest.Mock).mockResolvedValueOnce({ id: AUTOMATION_ID });
      const result = await deleteAutomation(AUTOMATION_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe(true);
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await deleteAutomation(AUTOMATION_ID);
      expect(result.error).toBeDefined();
    });
  });
});
