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
        id: SHARE_ID, boardId: BOARD_ID, token: "newtoken", isActive: true,
      });

      const result = await createBoardShareLink({ boardId: BOARD_ID });
      expect(result.error).toBeUndefined();
      expect(db.boardShare.updateMany).toHaveBeenCalled();
    });

    it("generates a token on creation", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValueOnce({ id: BOARD_ID, orgId: "org_1" });
      (db.boardShare.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      (db.boardShare.create as jest.Mock).mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: SHARE_ID, ...data })
      );

      const result = await createBoardShareLink({ boardId: BOARD_ID });
      expect(result.error).toBeUndefined();
      expect(result.data?.token).toBeDefined();
      expect(result.data?.boardId).toBe(BOARD_ID);
      const createCall = (db.boardShare.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.token).toBeDefined();
      expect(typeof createCall.data.token).toBe("string");
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createBoardShareLink({ boardId: BOARD_ID });
      expect(result.error).toBeDefined();
    });
  });

  // ─── checkShareRequiresPassword ──────────────────────────────────────────

  describe("checkShareRequiresPassword", () => {
    it("returns requiresPassword false for passwordless share", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, token: TOKEN, isActive: true,
      });
      const result = await checkShareRequiresPassword(TOKEN);
      expect(result.error).toBeUndefined();
      expect(result.data?.requiresPassword).toBe(false);
    });

    it("returns requiresPassword true for protected share", async () => {
      // The action checks `!!share.passwordHash` (not a `requiresPassword` field).
      // A non-null/non-empty passwordHash → requiresPassword: true.
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        id: SHARE_ID, token: TOKEN, isActive: true,
        passwordHash: "scrypt$fakesalt$fakehashvalue",
      });
      const result = await checkShareRequiresPassword(TOKEN);
      expect(result.error).toBeUndefined();
      expect(result.data?.requiresPassword).toBe(true);
    });

    it("returns error for invalid/inactive token", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await checkShareRequiresPassword("invalidtoken");
      expect(result.error).toBeDefined();
    });
  });

  // ─── getSharedBoardData ─────────────────────────────────────────────────

  describe("getSharedBoardData", () => {
    const MOCK_SHARE = {
      id: SHARE_ID,
      passwordHash: null as string | null,
      board: { id: BOARD_ID, title: "Test Board", lists: [] },
      allowComments: false,
      allowCopyCards: false,
      viewCount: 4,
    };

    it("returns board data for valid share with no password", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(MOCK_SHARE);
      (db.boardShare.update as jest.Mock).mockResolvedValueOnce({ ...MOCK_SHARE, viewCount: 5 });

      const result = await getSharedBoardData(TOKEN);
      expect(result.error).toBeUndefined();
      expect(result.data?.board.id).toBe(BOARD_ID);
      // viewCount is incremented in-action: original 4 + 1
      expect(result.data?.share.viewCount).toBe(5);
    });

    it("returns board data when the correct password is supplied", async () => {
      // scryptSync mock always returns Buffer.from("hashedpassword").
      // Build a stored hash whose hex part matches that buffer so verifyPassword succeeds.
      const correctPasswordHash = `scrypt$anysalt$${Buffer.from("hashedpassword").toString("hex")}`;
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        ...MOCK_SHARE,
        passwordHash: correctPasswordHash,
      });
      (db.boardShare.update as jest.Mock).mockResolvedValueOnce({ ...MOCK_SHARE, viewCount: 5 });

      const result = await getSharedBoardData(TOKEN, "anypassword");
      expect(result.error).toBeUndefined();
      expect(result.data?.board).toBeDefined();
    });

    it("returns INVALID_TOKEN error for invalid/inactive token", async () => {
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await getSharedBoardData("invalid-token");
      expect(result.error).toBeDefined();
      expect(result.code).toBe("INVALID_TOKEN");
    });

    it("returns INVALID_TOKEN error when password is wrong", async () => {
      // A malformed passwordHash string fails the 3-part scrypt split check →
      // verifyPassword returns false without reaching timingSafeEqual.
      (db.boardShare.findFirst as jest.Mock).mockResolvedValueOnce({
        ...MOCK_SHARE,
        passwordHash: "malformed-not-scrypt-format",
      });

      const result = await getSharedBoardData(TOKEN, "wrongpassword");
      expect(result.error).toBeDefined();
      expect(result.code).toBe("INVALID_TOKEN");
    });
  });

  // ─── revokeBoardShareLink ────────────────────────────────────────────────

  describe("revokeBoardShareLink", () => {
    // The source calls db.boardShare.updateMany (not findFirst+update).
    // It does NOT validate whether any rows existed before revoking — it just
    // calls updateMany and always returns { data: true } on success.

    it("calls boardShare.updateMany with isActive=false for the board", async () => {
      (db.boardShare.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

      const result = await revokeBoardShareLink(BOARD_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe(true);
      expect(db.boardShare.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ boardId: BOARD_ID, isActive: true }),
          data: { isActive: false },
        })
      );
    });

    it("returns { data: true } even when no active shares exist (count: 0)", async () => {
      // updateMany with 0 matching rows is not an error — the action always succeeds.
      (db.boardShare.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });

      const result = await revokeBoardShareLink(BOARD_ID);
      expect(result.data).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns error when DB throws", async () => {
      (db.boardShare.updateMany as jest.Mock).mockRejectedValueOnce(new Error("DB connection lost"));

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
