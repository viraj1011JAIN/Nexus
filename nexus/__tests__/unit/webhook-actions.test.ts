/**
 * TASK-031 — Unit tests: webhook-actions
 *
 * Covers: getWebhooks, createWebhook, updateWebhook, deleteWebhook, rotateWebhookSecret
 */

import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
} from "@/actions/webhook-actions";
import { db } from "@/lib/db";

const WEBHOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
    webhook: {
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
    userId: "user_1", orgId: "org_1", orgRole: "org:admin",
    membership: { role: "ADMIN", isActive: true },
  });
  requireRole.mockResolvedValue(undefined);
  isDemoContext.mockReturnValue(false);
}

describe("webhook-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getWebhooks ─────────────────────────────────────────────────────────

  describe("getWebhooks", () => {
    it("returns webhooks scoped to the org", async () => {
      (db.webhook.findMany as jest.Mock).mockResolvedValueOnce([
        { id: WEBHOOK_ID, url: "https://example.com/hook", events: ["card.created"] },
      ]);
      const result = await getWebhooks();
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(1);
      expect(db.webhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ orgId: "org_1" }) })
      );
    });

    it("returns error on db failure", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("DB error"));
      const result = await getWebhooks();
      expect(result.error).toBeDefined();
    });
  });

  // ─── createWebhook ───────────────────────────────────────────────────────

  describe("createWebhook", () => {
    it("returns validation error for invalid URL", async () => {
      const result = await createWebhook("not-a-url", ["card.created"]);
      expect(result.error).toBeDefined();
    });

    it("returns validation error when no events selected", async () => {
      const result = await createWebhook("https://example.com/hook", []);
      expect(result.error).toBeDefined();
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createWebhook("https://example.com/hook", ["card.created"]);
      expect(result.error).toBeDefined();
    });

    it("creates webhook with auto-generated secret starting with whsec_", async () => {
      (db.webhook.create as jest.Mock).mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: WEBHOOK_ID, ...data })
      );

      const result = await createWebhook("https://example.com/hook", ["card.created", "card.moved"]);
      expect(result.error).toBeUndefined();
      expect(result.data?.rawKey ?? (result.data as { secret?: string })?.secret).toBeUndefined(); // secret not in data.rawKey
      expect(db.webhook.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            secret: expect.stringMatching(/^whsec_/),
            orgId: "org_1",
            events: ["card.created", "card.moved"],
          }),
        })
      );
    });
  });

  // ─── updateWebhook ───────────────────────────────────────────────────────

  describe("updateWebhook", () => {
    it("returns error when webhook not found", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await updateWebhook(WEBHOOK_ID, { isEnabled: false });
      expect(result.error).toBeDefined();
    });

    it("updates fields when webhook exists", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID, orgId: "org_1" });
      (db.webhook.update as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID, isEnabled: false });

      const result = await updateWebhook(WEBHOOK_ID, { isEnabled: false });
      expect(result.error).toBeUndefined();
      expect(db.webhook.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── deleteWebhook ───────────────────────────────────────────────────────

  describe("deleteWebhook", () => {
    it("returns error when webhook not found", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await deleteWebhook(WEBHOOK_ID);
      expect(result.error).toBeDefined();
    });

    it("deletes webhook when it exists", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID, orgId: "org_1" });
      (db.webhook.delete as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID });

      const result = await deleteWebhook(WEBHOOK_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe(true);
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID, orgId: "org_1" });

      const result = await deleteWebhook(WEBHOOK_ID);
      expect(result.error).toBeDefined();
      expect(db.webhook.delete).not.toHaveBeenCalled();
    });
  });

  // ─── rotateWebhookSecret ─────────────────────────────────────────────────

  describe("rotateWebhookSecret", () => {
    it("returns error when webhook not found", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await rotateWebhookSecret(WEBHOOK_ID);
      expect(result.error).toBeDefined();
    });

    it("returns new secret starting with whsec_ prefix", async () => {
      (db.webhook.findFirst as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID, orgId: "org_1" });
      (db.webhook.update as jest.Mock).mockResolvedValueOnce({ id: WEBHOOK_ID });

      const result = await rotateWebhookSecret(WEBHOOK_ID);
      expect(result.error).toBeUndefined();
      expect((result.data as { secret: string })?.secret).toMatch(/^whsec_/);
    });
  });
});
