/**
 * TASK-031 — Unit tests: time-tracking-actions
 *
 * Covers: getTimeLogs, logTime
 */

import { getTimeLogs, logTime } from "@/actions/time-tracking-actions";
import { db } from "@/lib/db";

const CARD_ID  = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOARD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
    card: {
      findFirst: jest.fn(),
    },
    timeLog: {
      findMany: jest.fn(),
      create:   jest.fn(),
      findFirst: jest.fn(),
      update:   jest.fn(),
      delete:   jest.fn(),
      aggregate: jest.fn(),
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

describe("time-tracking-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getTimeLogs ─────────────────────────────────────────────────────────

  describe("getTimeLogs", () => {
    it("returns error when card not found or inaccessible", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await getTimeLogs(CARD_ID);
      expect(result.error).toBeDefined();
    });

    it("returns logs and totalMinutes", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce({ id: CARD_ID, list: { board: { orgId: "org_1" } } });
      (db.timeLog.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "log-1", minutes: 30, description: "research", loggedAt: new Date() },
        { id: "log-2", minutes: 60, description: "coding", loggedAt: new Date() },
      ]);
      (db.timeLog.aggregate as jest.Mock).mockResolvedValueOnce({ _sum: { minutes: 90 } });

      const result = await getTimeLogs(CARD_ID);
      expect(result.error).toBeUndefined();
      expect(result.data?.logs).toHaveLength(2);
      expect(result.data?.totalMinutes).toBe(90);
    });
  });

  // ─── logTime ─────────────────────────────────────────────────────────────

  describe("logTime", () => {
    it("returns error for 0 minutes", async () => {
      const result = await logTime(CARD_ID, 0);
      expect(result.error).toBeDefined();
    });

    it("returns error for minutes exceeding 100000", async () => {
      const result = await logTime(CARD_ID, 100001);
      expect(result.error).toBeDefined();
    });

    it("returns error when card not found", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await logTime(CARD_ID, 30);
      expect(result.error).toBeDefined();
    });

    it("creates time log successfully", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce({ id: CARD_ID, list: { board: { orgId: "org_1", id: BOARD_ID } } });
      (db.timeLog.create as jest.Mock).mockResolvedValueOnce({
        id: "log-1", cardId: CARD_ID, minutes: 45, description: "review", loggedAt: new Date(),
      });

      const result = await logTime(CARD_ID, 45, "review");
      expect(result.error).toBeUndefined();
      expect(result.data?.minutes).toBe(45);
    });

    it("accepts boundary value of 1 minute", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce({ id: CARD_ID, list: { board: { orgId: "org_1", id: BOARD_ID } } });
      (db.timeLog.create as jest.Mock).mockResolvedValueOnce({ id: "log-2", cardId: CARD_ID, minutes: 1, loggedAt: new Date() });

      const result = await logTime(CARD_ID, 1);
      expect(result.error).toBeUndefined();
    });

    it("accepts boundary value of 100000 minutes", async () => {
      (db.card.findFirst as jest.Mock).mockResolvedValueOnce({ id: CARD_ID, list: { board: { orgId: "org_1", id: BOARD_ID } } });
      (db.timeLog.create as jest.Mock).mockResolvedValueOnce({ id: "log-3", cardId: CARD_ID, minutes: 100000, loggedAt: new Date() });

      const result = await logTime(CARD_ID, 100000);
      expect(result.error).toBeUndefined();
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await logTime(CARD_ID, 30);
      expect(result.error).toBeDefined();
    });
  });
});
