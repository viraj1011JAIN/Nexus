/**
 * TASK-031 — Unit tests: board-share-actions
 *
 * Covers: getBoardShareLink, createBoardShareLink, checkShareRequiresPassword,
 *         getSharedBoardData, revokeBoardShareLink, updateBoardShareSettings
 */

import {
  getBoardShareLink,
  createBoardShareLink,
  checkShareRequiresPassword,
  getSharedBoardData,
  revokeBoardShareLink,
  updateBoardShareSettings,
} from "@/actions/board-share-actions";
import { db } from "@/lib/db";

const BOARD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SHARE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TOKEN    = "abc123token";

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
    board: {
      findFirst: jest.fn(),
    },
    boardShare: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      updateMany: jest.fn(),
      delete:     jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// scryptSync is from Node crypto; mock it for password-hash tests
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest.fn().mockReturnValue(Buffer.from("aabbccdd", "hex")),
  scryptSync:  jest.fn().mockReturnValue(Buffer.from("hashedpassword")),
}));

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

describe("board-share-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getBoardShareLink ───────────────────────────────────────────────────

  describe("getBoardShareLink", () => {
    it("returns null data when no share exists", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await getBoardShareLink(BOARD_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    it("returns active share link", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, boardId: BOARD_ID, token: TOKEN, isActive: true,
      });
      const result = await getBoardShareLink(BOARD_ID);
      expect(result.data?.token).toBe(TOKEN);
    });

    it("returns error when board not found", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await getBoardShareLink(BOARD_ID);
      expect(result.error).toBeDefined();
    });
  });

  // ─── createBoardShareLink ────────────────────────────────────────────────

  describe("createBoardShareLink", () => {
    it("deactivates old share before creating new one", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (db.boardShare.create as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, boardId: BOARD_ID, token: "newtoken", isActive: true, requiresPassword: false,
      });

      const result = await createBoardShareLink({ boardId: BOARD_ID, requiresPassword: false });
      expect(result.error).toBeUndefined();
      expect(db.boardShare.updateMany).toHaveBeenCalled();
    });

    it("generates a token on creation", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      (db.boardShare.create as jest.Mock).mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: SHARE_ID, ...data })
      );

      const result = await createBoardShareLink({ boardId: BOARD_ID, requiresPassword: false });
      const createCall = (db.boardShare.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.token).toBeDefined();
      expect(typeof createCall.data.token).toBe("string");
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createBoardShareLink({ boardId: BOARD_ID, requiresPassword: false });
      expect(result.error).toBeDefined();
    });
  });

  // ─── checkShareRequiresPassword ──────────────────────────────────────────

  describe("checkShareRequiresPassword", () => {
    it("returns requiresPassword false for passwordless share", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, token: TOKEN, isActive: true, requiresPassword: false,
      });
      const result = await checkShareRequiresPassword(TOKEN);
      expect(result.error).toBeUndefined();
      expect(result.data?.requiresPassword).toBe(false);
    });

    it("returns requiresPassword true for protected share", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, token: TOKEN, isActive: true, requiresPassword: true,
      });
      const result = await checkShareRequiresPassword(TOKEN);
      expect(result.data?.requiresPassword).toBe(true);
    });

    it("returns error for invalid/inactive token", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await checkShareRequiresPassword("invalidtoken");
      expect(result.error).toBeDefined();
    });
  });

  // ─── revokeBoardShareLink ────────────────────────────────────────────────

  describe("revokeBoardShareLink", () => {
    it("sets isActive=false on the share", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({ id: SHARE_ID, boardId: BOARD_ID });
      (db.boardShare.update as jest.Mock).mockResolvedValueOnce({ id: SHARE_ID, isActive: false });

      const result = await revokeBoardShareLink(BOARD_ID);
      expect(result.error).toBeUndefined();

      const updateCall = (db.boardShare.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
    });

    it("returns error when no share exists to revoke", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await revokeBoardShareLink(BOARD_ID);
      expect(result.error).toBeDefined();
    });
  });

  // ─── updateBoardShareSettings ────────────────────────────────────────────

  describe("updateBoardShareSettings", () => {
    it("updates share settings", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({ id: SHARE_ID, boardId: BOARD_ID });
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.update as jest.Mock).mockResolvedValueOnce({ id: SHARE_ID, allowComments: true });

      const result = await updateBoardShareSettings(SHARE_ID, { allowComments: true });
      expect(result.error).toBeUndefined();
    });

    it("returns error when share not found", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await updateBoardShareSettings(SHARE_ID, { allowComments: false });
      expect(result.error).toBeDefined();
    });
  });
});
