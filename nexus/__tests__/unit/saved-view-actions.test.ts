/**
 * TASK-031 — Unit tests: saved-view-actions
 *
 * Covers: getSavedViews, createSavedView, updateSavedView, deleteSavedView
 */

import {
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} from "@/actions/saved-view-actions";
import { db } from "@/lib/db";

const BOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIEW_ID  = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    savedView: {
      findMany:  jest.fn(),
      create:    jest.fn(),
      findFirst: jest.fn(),
      update:    jest.fn(),
      delete:    jest.fn(),
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
    userId: "user_1", orgId: "org_1", orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  });
  requireRole.mockResolvedValue(undefined);
  isDemoContext.mockReturnValue(false);
}

describe("saved-view-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getSavedViews ───────────────────────────────────────────────────────

  describe("getSavedViews", () => {
    it("returns views for current user + shared views", async () => {
      (db.savedView.findMany as jest.Mock).mockResolvedValueOnce([
        { id: VIEW_ID, name: "My View",     isShared: false },
        { id: "v2",    name: "Team View",   isShared: true  },
      ]);
      const result = await getSavedViews();
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(2);
    });

    it("filters by boardId when provided", async () => {
      (db.savedView.findMany as jest.Mock).mockResolvedValueOnce([]);
      await getSavedViews(BOARD_ID);
      expect(db.savedView.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ boardId: BOARD_ID }),
        })
      );
    });

    it("returns error on failure", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("DB error"));
      const result = await getSavedViews();
      expect(result.error).toBeDefined();
    });
  });

  // ─── createSavedView ─────────────────────────────────────────────────────

  describe("createSavedView", () => {
    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createSavedView("My View", { priorities: ["HIGH"] });
      expect(result.error).toBeDefined();
    });

    it("returns error when name is empty", async () => {
      const result = await createSavedView("", { priorities: ["HIGH"] });
      expect(result.error).toBeDefined();
    });

    it("returns error when name exceeds 100 chars", async () => {
      const result = await createSavedView("x".repeat(101), {});
      expect(result.error).toBeDefined();
    });

    it("creates view with default kanban viewType", async () => {
      (db.savedView.create as jest.Mock).mockResolvedValueOnce({
        id: VIEW_ID, name: "My View", orgId: "org_1", viewType: "kanban",
      });
      const result = await createSavedView("My View", { priorities: ["HIGH"] });
      expect(result.error).toBeUndefined();
      expect(db.savedView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "My View", viewType: "kanban", orgId: "org_1" }),
        })
      );
    });

    it("creates shared view when isShared is true", async () => {
      (db.savedView.create as jest.Mock).mockResolvedValueOnce({
        id: VIEW_ID, name: "Sprint View", isShared: true,
      });
      const result = await createSavedView("Sprint View", {}, "kanban", undefined, true);
      expect(result.error).toBeUndefined();
    });
  });

  // ─── updateSavedView ─────────────────────────────────────────────────────

  describe("updateSavedView", () => {
    it("returns error when view not found or not owned", async () => {
      (db.savedView.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await updateSavedView(VIEW_ID, { name: "Updated" });
      expect(result.error).toBeDefined();
    });

    it("updates view when owned by user", async () => {
      (db.savedView.findFirst as jest.Mock).mockResolvedValueOnce({
        id: VIEW_ID, userId: "user_1", orgId: "org_1",
      });
      (db.savedView.update as jest.Mock).mockResolvedValueOnce({ id: VIEW_ID, name: "Updated" });
      const result = await updateSavedView(VIEW_ID, { name: "Updated" });
      expect(result.error).toBeUndefined();
    });
  });

  // ─── deleteSavedView ─────────────────────────────────────────────────────

  describe("deleteSavedView", () => {
    it("returns error when view not found", async () => {
      (db.savedView.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await deleteSavedView(VIEW_ID);
      expect(result.error).toBeDefined();
    });

    it("deletes view when owned by user", async () => {
      (db.savedView.findFirst as jest.Mock).mockResolvedValueOnce({
        id: VIEW_ID, userId: "user_1", orgId: "org_1",
      });
      (db.savedView.delete as jest.Mock).mockResolvedValueOnce({ id: VIEW_ID });
      const result = await deleteSavedView(VIEW_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe(true);
    });
  });
});
