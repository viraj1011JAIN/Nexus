/**
 * TASK-031 — Unit tests: notification-actions
 *
 * Covers: getNotifications, getUnreadNotificationCount,
 *         markNotificationRead, markAllNotificationsRead
 */

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notification-actions";
import { db } from "@/lib/db";

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
    notification: {
      findMany:    jest.fn(),
      count:       jest.fn(),
      updateMany:  jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function resetMocks() {
  const { getTenantContext, requireRole } = jest.requireMock("@/lib/tenant-context") as {
    getTenantContext: jest.Mock; requireRole: jest.Mock;
  };
  getTenantContext.mockResolvedValue({
    userId: "user_1", orgId: "org_1", orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  });
  requireRole.mockResolvedValue(undefined);
}

describe("notification-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getNotifications ────────────────────────────────────────────────────

  describe("getNotifications", () => {
    it("returns notification list on success", async () => {
      const notifications = [
        { id: "n1", type: "MENTIONED", title: "You were mentioned", isRead: false },
        { id: "n2", type: "ASSIGNED",  title: "Card assigned",      isRead: true  },
      ];
      (db.notification.findMany as jest.Mock).mockResolvedValueOnce(notifications);

      const result = await getNotifications();
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(2);
    });

    it("returns error when getTenantContext rejects", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("tenant context failure"));

      const result = await getNotifications();
      expect(result.error).toBeDefined();
    });

    it("returns error when db.notification.findMany rejects", async () => {
      // getTenantContext succeeds; DB layer fails — distinct from the auth failure path.
      (db.notification.findMany as jest.Mock).mockRejectedValueOnce(new Error("DB error"));
      const result = await getNotifications();
      expect(result.error).toBeDefined();
    });

    it("filters by orgId and userId", async () => {
      (db.notification.findMany as jest.Mock).mockResolvedValueOnce([]);
      await getNotifications();

      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: "org_1", userId: "user_1" }),
        })
      );
    });
  });

  // ─── getUnreadNotificationCount ─────────────────────────────────────────

  describe("getUnreadNotificationCount", () => {
    it("returns the unread count", async () => {
      (db.notification.count as jest.Mock).mockResolvedValueOnce(7);

      const result = await getUnreadNotificationCount();
      expect(result.data).toBe(7);
    });

    it("returns 0 on failure (graceful degradation)", async () => {
      (db.notification.count as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

      const result = await getUnreadNotificationCount();
      expect(result.data).toBe(0);
    });
  });

  // ─── markNotificationRead ────────────────────────────────────────────────

  describe("markNotificationRead", () => {
    it("calls updateMany with the correct filter", async () => {
      const { revalidatePath } = jest.requireMock("next/cache") as { revalidatePath: jest.Mock };
      (db.notification.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

      const result = await markNotificationRead("n1");
      expect(result.error).toBeUndefined();
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: { id: "n1", userId: "user_1", orgId: "org_1" },
        data: { isRead: true },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("returns error on db failure", async () => {
      (db.notification.updateMany as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

      const result = await markNotificationRead("n1");
      expect(result.error).toBeDefined();
    });
  });

  // ─── markAllNotificationsRead ────────────────────────────────────────────

  describe("markAllNotificationsRead", () => {
    it("marks all unread notifications for the user", async () => {
      const { revalidatePath } = jest.requireMock("next/cache") as { revalidatePath: jest.Mock };
      (db.notification.updateMany as jest.Mock).mockResolvedValueOnce({ count: 5 });

      const result = await markAllNotificationsRead();
      expect(result.error).toBeUndefined();
      expect(db.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user_1", orgId: "org_1", isRead: false }),
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("returns error on db failure", async () => {
      (db.notification.updateMany as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

      const result = await markAllNotificationsRead();
      expect(result.error).toBeDefined();
    });
  });
});
