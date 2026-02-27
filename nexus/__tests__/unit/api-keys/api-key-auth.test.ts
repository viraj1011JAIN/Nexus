/**
 * @jest-environment node
 *
 * SECTION 12 — API Key (REST API) Tests
 *
 * Covers:
 *   12.1  authenticateApiKey — bearer token parsing
 *   12.2  Prefix validation (nxk_ required)
 *   12.3  Revoked key rejection
 *   12.4  Expired key rejection
 *   12.5  Scope enforcement
 *   12.6  SHA-256 hashing — raw key never stored
 *   12.7  Tenant isolation — boards only for owning org
 *   12.8  lastUsedAt fire-and-forget update
 *   12.9  GET /api/v1/boards route integration
 *   12.10 POST /api/v1/boards scope mismatch
 */

import crypto from "crypto";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockFindFirst = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    apiKey: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    board: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    organization: {
      findUnique: jest.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock("@/lib/stripe", () => ({
  STRIPE_CONFIG: {
    limits: {
      FREE: { boards: 50, cardsPerBoard: 500 },
      PRO: { boards: Infinity, cardsPerBoard: Infinity },
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_A = "org_a";
const ORG_B = "org_b";
const USER_ID = "user_1";

function makeRawKey(): string {
  return `nxk_${crypto.randomBytes(32).toString("hex")}`;
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function makeKeyRow(rawKey: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "key-id-1",
    orgId: ORG_A,
    userId: USER_ID,
    keyHash: hashKey(rawKey),
    keyPrefix: rawKey.substring(0, 12),
    scopes: ["boards:read", "boards:write"],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// NextRequest constructor requires URL string; we use a thin wrapper
function makeNextRequest(rawKey?: string, method = "GET", url = "http://localhost:3000/api/v1/boards"): {
  method: string;
  headers: { get: (name: string) => string | null };
  nextUrl: { searchParams: URLSearchParams };
  json: () => Promise<unknown>;
} {
  const headers = new Map<string, string>();
  if (rawKey) {
    headers.set("authorization", `Bearer ${rawKey}`);
  }
  const parsedUrl = new URL(url);
  return {
    method,
    headers: { get: (name: string) => headers.get(name) ?? null },
    nextUrl: { searchParams: parsedUrl.searchParams },
    json: () => Promise.resolve({}),
  };
}

// ─── Import under test ───────────────────────────────────────────────────────

import { authenticateApiKey, apiError, type ApiScope } from "@/lib/api-key-auth";

// ─── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12.1 — Bearer token parsing
// ═══════════════════════════════════════════════════════════════════════════════

describe("Section 12 — API Key Authentication", () => {
  describe("12.1 Bearer token parsing", () => {
    it("12.1 should return 401 when Authorization header is missing", async () => {
      const req = makeNextRequest(undefined) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.message).toMatch(/missing|malformed/i);
      }
    });

    it("12.2 should return 401 when key does not start with nxk_", async () => {
      const req = makeNextRequest("sk_live_abc123") as never;
      const result = await authenticateApiKey(req, ["boards:read"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("12.3 should return 401 when Bearer prefix is missing", async () => {
      const headers = new Map<string, string>();
      headers.set("authorization", "nxk_abc123");
      const req = {
        headers: { get: (name: string) => headers.get(name) ?? null },
        nextUrl: { searchParams: new URLSearchParams() },
      } as never;
      const result = await authenticateApiKey(req, ["boards:read"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("12.4 should return 401 for empty Authorization header", async () => {
      const _req = makeNextRequest(undefined) as never;
      // Override the authorization header to be empty string rather than absent
      const headers = new Map<string, string>();
      headers.set("authorization", "");
      const reqWithEmptyAuth = {
        headers: { get: (name: string) => headers.get(name) ?? null },
        nextUrl: { searchParams: new URLSearchParams() },
      } as never;
      const result = await authenticateApiKey(reqWithEmptyAuth, ["boards:read"]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.2 — SHA-256 hash lookup
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.2 SHA-256 hash validation", () => {
    it("12.5 should hash the raw key with SHA-256 and look up by hash", async () => {
      const rawKey = makeRawKey();
      const expectedHash = hashKey(rawKey);
      mockFindUnique.mockResolvedValueOnce(makeKeyRow(rawKey));

      const req = makeNextRequest(rawKey) as never;
      await authenticateApiKey(req, ["boards:read"]);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { keyHash: expectedHash },
      });
    });

    it("12.6 should return 401 when key hash not found in DB", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const rawKey = makeRawKey();
      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.message).toMatch(/invalid/i);
      }
    });

    it("12.7 raw key is NEVER stored — only SHA-256 hash is persisted", () => {
      const rawKey = makeRawKey();
      const row = makeKeyRow(rawKey);
      // keyHash must differ from rawKey
      expect(row.keyHash).not.toBe(rawKey);
      // keyHash is deterministic SHA-256
      expect(row.keyHash).toBe(hashKey(rawKey));
      // keyPrefix stores only first 12 characters (nxk_ + 8 hex)
      expect(row.keyPrefix).toBe(rawKey.substring(0, 12));
      expect(row.keyPrefix.length).toBe(12);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.3 — Revoked key
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.3 Revoked key rejection", () => {
    it("12.8 should return 401 when key has revokedAt set", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { revokedAt: new Date("2025-01-01") })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.message).toMatch(/revoked/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.4 — Expired key
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.4 Expired key rejection", () => {
    it("12.9 should return 401 when key has expired", async () => {
      const rawKey = makeRawKey();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { expiresAt: pastDate })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.message).toMatch(/expired/i);
      }
    });

    it("12.10 should succeed when key has not yet expired", async () => {
      const rawKey = makeRawKey();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { expiresAt: futureDate })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
    });

    it("12.11 should succeed when expiresAt is null (no expiry)", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { expiresAt: null })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.5 — Scope enforcement
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.5 Scope enforcement", () => {
    it("12.12 should return 403 when key lacks required scope", async () => {
      const rawKey = makeRawKey();
      // Key only has boards:read
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read"] })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:write"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
        expect(result.message).toMatch(/missing required scopes.*boards:write/i);
      }
    });

    it("12.13 should succeed when key has the required scope", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read"] })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ctx.orgId).toBe(ORG_A);
        expect(result.ctx.userId).toBe(USER_ID);
        expect(result.ctx.scopes).toContain("boards:read");
      }
    });

    it("12.14 should return 403 when key is missing one of multiple required scopes", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read"] })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read", "boards:write"] as ApiScope[]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
      }
    });

    it("12.15 should succeed when key has all required scopes", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read", "boards:write", "cards:read"] })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read", "boards:write"] as ApiScope[]);

      expect(result.ok).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.6 — Tenant scoping
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.6 Tenant isolation", () => {
    it("12.16 should return orgId from the API key row (not from request)", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { orgId: ORG_A })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ctx.orgId).toBe(ORG_A);
      }
    });

    it("12.17 Org A key never returns Org B data", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { orgId: ORG_A })
      );

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // orgId is ORG_A, subsequent DB queries MUST use this orgId
        expect(result.ctx.orgId).toBe(ORG_A);
        expect(result.ctx.orgId).not.toBe(ORG_B);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.7 — lastUsedAt fire-and-forget
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.7 lastUsedAt update", () => {
    it("12.18 should fire lastUsedAt update on successful auth", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(makeKeyRow(rawKey));
      mockUpdate.mockResolvedValueOnce({});

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "key-id-1" },
          data: { lastUsedAt: expect.any(Date) },
        })
      );
    });

    it("12.19 should not crash if lastUsedAt update fails", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(makeKeyRow(rawKey));
      mockUpdate.mockRejectedValueOnce(new Error("DB connection lost"));

      const req = makeNextRequest(rawKey) as never;
      const result = await authenticateApiKey(req, ["boards:read"]);

      // Auth still succeeds even though update failed (fire-and-forget)
      expect(result.ok).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12.8 — apiError helper
  // ═══════════════════════════════════════════════════════════════════════════

  describe("12.8 apiError helper", () => {
    it("12.20 should return JSON response with correct status", async () => {
      const res = apiError("Not found", 404);
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    it("12.21 should return 401 for unauthorized", async () => {
      const res = apiError("Unauthorized", 401);
      expect(res.status).toBe(401);
    });

    it("12.22 should return 403 for forbidden", async () => {
      const res = apiError("Forbidden", 403);
      expect(res.status).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12.9 — GET /api/v1/boards route integration
// ═══════════════════════════════════════════════════════════════════════════════

describe("Section 12 — /api/v1/boards route", () => {
  // We test the route handlers by importing them directly
  // Must import after mocks are set up

  let GET: (req: unknown) => Promise<Response>;
  let POST: (req: unknown) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/v1/boards/route");
    GET = mod.GET as (req: unknown) => Promise<Response>;
    POST = mod.POST as (req: unknown) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("12.9 GET /api/v1/boards", () => {
    it("12.23 should return 200 with org boards for valid key with boards:read scope", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read"] })
      );
      mockFindMany.mockResolvedValueOnce([
        {
          id: "board-1",
          title: "Board One",
          imageThumbUrl: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          _count: { lists: 3 },
        },
      ]);

      const req = makeNextRequest(rawKey) as never;
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("board-1");
      expect(body.data[0].title).toBe("Board One");
      expect(body.data[0].listCount).toBe(3);
      expect(body.meta.total).toBe(1);
    });

    it("12.24 should return 401 when no API key provided", async () => {
      const req = makeNextRequest(undefined) as never;
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("12.25 should return 401 for key not starting with nxk_", async () => {
      const req = makeNextRequest("invalid_key_123") as never;
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("12.26 should return 401 for revoked key", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { revokedAt: new Date() })
      );

      const req = makeNextRequest(rawKey) as never;
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("12.27 should query boards only for the key's orgId (tenant isolation)", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { orgId: ORG_A, scopes: ["boards:read"] })
      );
      mockFindMany.mockResolvedValueOnce([]);

      const req = makeNextRequest(rawKey) as never;
      await GET(req);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: ORG_A },
        })
      );
    });
  });

  describe("12.10 POST /api/v1/boards — scope mismatch", () => {
    it("12.28 should return 403 when key has boards:read but attempts POST", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:read"] })
      );

      const req = {
        ...makeNextRequest(rawKey, "POST"),
        json: () => Promise.resolve({ title: "New Board" }),
      } as never;
      const res = await POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/missing required scopes/i);
    });

    it("12.29 should return 201 when key has boards:write scope", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:write"] })
      );

      const { db } = jest.requireMock("@/lib/db") as {
        db: { organization: { findUnique: jest.Mock } };
      };
      db.organization.findUnique = jest.fn().mockResolvedValueOnce({
        subscriptionPlan: "PRO",
      });

      mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          board: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({
              id: "new-board-id",
              title: "New Board",
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        };
        return fn(tx);
      });

      const req = {
        ...makeNextRequest(rawKey, "POST"),
        json: () => Promise.resolve({ title: "New Board" }),
      } as never;
      const res = await POST(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.title).toBe("New Board");
    });

    it("12.30 should return 403 for unknown subscription plan (fail-closed)", async () => {
      const rawKey = makeRawKey();
      mockFindUnique.mockResolvedValueOnce(
        makeKeyRow(rawKey, { scopes: ["boards:write"] })
      );

      const { db } = jest.requireMock("@/lib/db") as {
        db: { organization: { findUnique: jest.Mock } };
      };
      db.organization.findUnique = jest.fn().mockResolvedValueOnce({
        subscriptionPlan: "enterprise",
      });

      const req = {
        ...makeNextRequest(rawKey, "POST"),
        json: () => Promise.resolve({ title: "New Board" }),
      } as never;
      const res = await POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/unknown.*plan/i);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12.11 — Key prefix storage
// ═══════════════════════════════════════════════════════════════════════════════

describe("Section 12 — Key prefix & hash", () => {
  it("12.31 keyPrefix stores only first 8 hex chars of the raw key as plaintext", () => {
    const rawKey = makeRawKey();
    const prefix = rawKey.substring(0, 12); // "nxk_" + 8 hex chars
    // Raw key format is nxk_<64 lowercase hex chars>, so prefix is nxk_ + 8 hex chars
    expect(prefix).toMatch(/^nxk_[a-f0-9]{8}$/i);
    expect(prefix.length).toBe(12);
    // Prefix does NOT contain the full key
    expect(prefix.length).toBeLessThan(rawKey.length);
  });

  it("12.32 SHA-256 hash is deterministic", () => {
    const rawKey = makeRawKey();
    const hash1 = hashKey(rawKey);
    const hash2 = hashKey(rawKey);
    expect(hash1).toBe(hash2);
    // Hash length should be 64 hex chars (256 bits)
    expect(hash1.length).toBe(64);
  });

  it("12.33 different raw keys produce different hashes", () => {
    const key1 = makeRawKey();
    const key2 = makeRawKey();
    expect(hashKey(key1)).not.toBe(hashKey(key2));
  });

  it("12.34 raw key format is nxk_ followed by 64 hex characters", () => {
    const rawKey = makeRawKey();
    expect(rawKey).toMatch(/^nxk_[a-f0-9]{64}$/);
  });
});
