/**
 * TASK-031 — Unit tests: api-key-actions
 *
 * Covers: getApiKeys, createApiKey, revokeApiKey, deleteApiKey
 */

import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
} from "@/actions/api-key-actions";
import { db } from "@/lib/db";

const KEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
    apiKey: {
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

describe("api-key-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── getApiKeys ──────────────────────────────────────────────────────────

  describe("getApiKeys", () => {
    it("returns keys scoped to org (never returning keyHash)", async () => {
      (db.apiKey.findMany as jest.Mock).mockResolvedValueOnce([
        { id: KEY_ID, name: "CI Key", keyPrefix: "nxk_abc123", scopes: ["boards:read"] },
      ]);
      const result = await getApiKeys();
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(1);
      // keyHash should never be selected
      expect((result.data?.[0] as Record<string, unknown>)?.keyHash).toBeUndefined();
    });

    it("returns error on failure", async () => {
      const { getTenantContext } = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
      getTenantContext.mockRejectedValueOnce(new Error("DB error"));
      const result = await getApiKeys();
      expect(result.error).toBeDefined();
    });
  });

  // ─── createApiKey ────────────────────────────────────────────────────────

  describe("createApiKey", () => {
    it("returns error for empty name", async () => {
      const result = await createApiKey("", ["boards:read"]);
      expect(result.error).toBeDefined();
    });

    it("returns error when no scopes selected", async () => {
      const result = await createApiKey("My Key", []);
      expect(result.error).toBeDefined();
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await createApiKey("My Key", ["boards:read"]);
      expect(result.error).toBeDefined();
    });

    it("returns rawKey starting with nxk_ prefix", async () => {
      (db.apiKey.create as jest.Mock).mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: KEY_ID,
          name: data.name,
          keyPrefix: data.keyPrefix,
          scopes: data.scopes,
          expiresAt: null,
          createdAt: new Date(),
        })
      );

      const result = await createApiKey("CI Key", ["boards:read", "cards:write"]);
      expect(result.error).toBeUndefined();
      expect((result.data as { rawKey: string })?.rawKey).toMatch(/^nxk_/);
    });

    it("rawKey is never stored as plaintext in DB", async () => {
      (db.apiKey.create as jest.Mock).mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: KEY_ID, ...data })
      );

      await createApiKey("My Key", ["boards:read"]);

      const createCall = (db.apiKey.create as jest.Mock).mock.calls[0][0];
      // keyHash should be a hex string (SHA-256), never the raw key
      expect(createCall.data.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createCall.data).not.toHaveProperty("rawKey");
    });
  });

  // ─── revokeApiKey ────────────────────────────────────────────────────────

  describe("revokeApiKey", () => {
    it("returns error when key not found", async () => {
      (db.apiKey.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await revokeApiKey(KEY_ID);
      expect(result.error).toBeDefined();
    });

    it("sets revokedAt on the key", async () => {
      (db.apiKey.findFirst as jest.Mock).mockResolvedValueOnce({ id: KEY_ID, orgId: "org_1" });
      (db.apiKey.update as jest.Mock).mockResolvedValueOnce({ id: KEY_ID, revokedAt: new Date() });

      const result = await revokeApiKey(KEY_ID);
      expect(result.error).toBeUndefined();
      const updateCall = (db.apiKey.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.revokedAt).toBeDefined();
    });
  });

  // ─── deleteApiKey ────────────────────────────────────────────────────────

  describe("deleteApiKey", () => {
    it("returns error when key not found", async () => {
      (db.apiKey.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await deleteApiKey(KEY_ID);
      expect(result.error).toBeDefined();
    });

    it("hard-deletes key", async () => {
      (db.apiKey.findFirst as jest.Mock).mockResolvedValueOnce({ id: KEY_ID, orgId: "org_1" });
      (db.apiKey.delete as jest.Mock).mockResolvedValueOnce({ id: KEY_ID });
      const result = await deleteApiKey(KEY_ID);
      expect(result.error).toBeUndefined();
      expect(result.data).toBe(true);
    });

    it("returns error in demo mode", async () => {
      const { isDemoContext } = jest.requireMock("@/lib/tenant-context") as { isDemoContext: jest.Mock };
      isDemoContext.mockReturnValue(true);
      const result = await deleteApiKey(KEY_ID);
      expect(result.error).toBeDefined();
    });
  });
});
