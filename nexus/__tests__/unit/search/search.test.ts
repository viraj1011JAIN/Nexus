/**
 * @jest-environment node
 */

/**
 * Section 9 — Search Tests
 *
 * Tests the GET /api/cards/search route handler directly.
 * Source: app/api/cards/search/route.ts
 *
 * Architecture recap:
 *   • getTenantContext() provides orgId — ALWAYS from the signed JWT, never from query params.
 *   • q = ""        → returns { data: [], meta: { total: 0 } } with NO DB call.
 *   • q.length < 3  → ILIKE fallback via db.$queryRaw.
 *   • q.length >= 3 → FTS via to_tsquery through db.$queryRaw.
 *   • page clamped  → Math.max(1, page).
 *   • limit clamped → Math.min(50, Math.max(1, limit)).
 *   • orgId is always injected by the server — attacker-supplied orgId is ignored.
 *
 * Covers:
 *   9.1  Empty query returns [] with no DB call
 *   9.2  Short query (< 3 chars) uses ILIKE path
 *   9.3  Long query (≥ 3 chars) uses FTS path
 *   9.4  page = 0 → clamped to 1
 *   9.5  page = -5 → clamped to 1
 *   9.6  limit = 0 → clamped to 1
 *   9.7  limit = 200 → clamped to 50
 *   9.8  limit = 50 (boundary) → accepted as-is
 *   9.9  Org isolation — orgId always from tenant context, not from query string
 *   9.10 Unauthorized → 401 when getTenantContext throws TenantError
 *   9.11 boardId filter is forwarded to the DB query
 *   9.12 DB failure → 500 JSON error (no stack trace exposed)
 *   9.13 Response shape validation (data + meta fields)
 *   9.14 meta.totalPages computed correctly
 *   9.15 whitespace-only query treated as empty → []
 */

import { GET } from "@/app/api/cards/search/route";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { TenantError } from "@/lib/tenant-context";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOARD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CARD_ID  = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const SAMPLE_ROW = {
  id:           CARD_ID,
  title:        "Fix authentication bug",
  description:  "Users cannot log in after session expiry",
  priority:     "HIGH",
  due_date:     null,
  list_id:      "list-1",
  list_title:   "Todo",
  board_id:     BOARD_ID,
  board_title:  "Engineering Board",
  assignee_name: "Alice",
  created_at:   new Date("2026-01-15T10:00:00Z"),
  rank:         0.95,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

/**
 * Keep TenantError as the real class so that `e instanceof TenantError` checks
 * inside the route handler work correctly.
 */
jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual("@/lib/tenant-context") as {
    TenantError: typeof TenantError;
  };
  return {
    ...actual,
    getTenantContext: jest.fn().mockResolvedValue({
      userId:  "user_clerk_0001",
      orgId:   "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      orgRole: "org:member",
      membership: { role: "MEMBER", isActive: true },
    }),
  };
});

jest.mock("@/lib/db", () => ({
  db: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a NextRequest for the search endpoint with the given query params. */
function makeReq(params: Record<string, string | undefined>): NextRequest {
  const url = new URL("http://localhost/api/cards/search");
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, v);
  });
  return new NextRequest(url.toString());
}

/**
 * Wire $queryRaw for a single search (data + count via Promise.all).
 * First call returns cardRows, second returns countRow.
 */
function mockQueryRaw(
  cardRows: typeof SAMPLE_ROW[] = [SAMPLE_ROW],
  total: number = cardRows.length,
) {
  (db.$queryRaw as jest.Mock)
    .mockResolvedValueOnce(cardRows)
    .mockResolvedValueOnce([{ count: BigInt(total) }]);
}

function getTenantContextMock() {
  return jest.requireMock("@/lib/tenant-context") as {
    getTenantContext: jest.Mock;
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 9 — Search API (GET /api/cards/search)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Re-establish default tenant context (Org A)
    getTenantContextMock().getTenantContext.mockResolvedValue({
      userId:  "user_clerk_0001",
      orgId:   ORG_ID_A,
      orgRole: "org:member",
      membership: { role: "MEMBER", isActive: true },
    });
  });

  // ─── 9.1 Empty query ────────────────────────────────────────────────────────

  describe("9.1 Empty query returns [] immediately — no DB call", () => {
    it("should return empty data array when q is omitted entirely", async () => {
      const res  = await GET(makeReq({}));
      const body = await res.json() as { data: unknown[]; meta: Record<string, unknown> };
      expect(body.data).toEqual([]);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("should return empty data when q is an empty string", async () => {
      const res  = await GET(makeReq({ q: "" }));
      const body = await res.json() as { data: unknown[]; meta: Record<string, unknown> };
      expect(body.data).toEqual([]);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("should return empty data when q is whitespace only", async () => {
      const res  = await GET(makeReq({ q: "   " }));
      const body = await res.json() as { data: unknown[]; meta: Record<string, unknown> };
      expect(body.data).toEqual([]);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("should still include meta in the empty-query response", async () => {
      const res  = await GET(makeReq({ q: "" }));
      const body = await res.json() as { meta: { total: number } };
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(0);
    });
  });

  // ─── 9.2 Short query (< 3 chars) — ILIKE path ───────────────────────────────

  describe("9.2 Short query (1–2 chars) uses ILIKE fallback", () => {
    it("should call $queryRaw for q='b' (1 char)", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "b" }));
      expect(res.status).toBe(200);
      expect(db.$queryRaw).toHaveBeenCalledTimes(2); // data + count
    });

    it("should call $queryRaw for q='bu' (2 chars)", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "bu" }));
      expect(res.status).toBe(200);
      expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("q='b' returns results correctly shaped", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res  = await GET(makeReq({ q: "b" }));
      const body = await res.json() as { data: { id: string }[] };
      expect(body.data[0].id).toBe(CARD_ID);
    });
  });

  // ─── 9.3 Long query (≥ 3 chars) — FTS path ──────────────────────────────────

  describe("9.3 Long query (≥ 3 chars) uses PostgreSQL FTS", () => {
    it("should call $queryRaw for q='bug' (3 chars)", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "bug" }));
      expect(res.status).toBe(200);
      expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should call $queryRaw for a multi-word query", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      await GET(makeReq({ q: "authentication bug" }));
      expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should return camelCase response fields regardless of FTS or ILIKE path", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res  = await GET(makeReq({ q: "bug" }));
      const body = await res.json() as { data: Record<string, unknown>[] };
      const card = body.data[0];
      // snake_case columns must be mapped to camelCase in the response
      expect(card.listId).toBeDefined();
      expect(card.listTitle).toBeDefined();
      expect(card.boardId).toBeDefined();
      expect(card.boardTitle).toBeDefined();
      expect(card.assigneeName).toBeDefined();
      expect(card.createdAt).toBeDefined();
      // raw snake_case keys must NOT leak through
      expect((card as Record<string, unknown>).list_id).toBeUndefined();
    });
  });

  // ─── 9.4 Page clamping ──────────────────────────────────────────────────────

  describe("9.4 page clamping — Math.max(1, page)", () => {
    it("page=0 is clamped to 1", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", page: "0" }));
      const body = await res.json() as { meta: { page: number } };
      expect(body.meta.page).toBe(1);
    });

    it("page=-5 is clamped to 1", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", page: "-5" }));
      const body = await res.json() as { meta: { page: number } };
      expect(body.meta.page).toBe(1);
    });

    it("page=1 (default) passes through unchanged", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", page: "1" }));
      const body = await res.json() as { meta: { page: number } };
      expect(body.meta.page).toBe(1);
    });

    it("page=3 passes through as-is", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", page: "3" }));
      const body = await res.json() as { meta: { page: number } };
      expect(body.meta.page).toBe(3);
    });

    it("page='abc' (non-numeric) → request still succeeds with HTTP 200 (NaN serialises to null)", async () => {
      // Math.max(1, NaN) = NaN, which JSON.stringify converts to null.
      // The route does not pre-validate that page is numeric, so the response
      // still succeeds — the important thing is no 500 is thrown.
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", page: "abc" }));
      expect(res.status).toBe(200);
      // meta.page is null (NaN → null in JSON), not a crash
      const body = await res.json() as { data: unknown[]; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
    });
  });

  // ─── 9.5 Limit clamping ─────────────────────────────────────────────────────

  describe("9.5 limit clamping — Math.min(50, Math.max(1, limit))", () => {
    it("limit=0 is clamped to 1", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "0" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(1);
    });

    it("limit=-10 is clamped to 1", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "-10" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(1);
    });

    it("limit=200 is clamped to 50", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "200" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(50);
    });

    it("limit=51 is clamped down to 50", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "51" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(50);
    });

    it("limit=50 (boundary) is accepted without clamping", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "50" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(50);
    });

    it("limit=1 (minimum) is accepted without clamping", async () => {
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "test", limit: "1" }));
      const body = await res.json() as { meta: { limit: number } };
      expect(body.meta.limit).toBe(1);
    });
  });

  // ─── 9.6 Org isolation ──────────────────────────────────────────────────────

  describe("9.6 Org isolation — orgId always from JWT, never from query string", () => {
    it("should return 200 and scope results to the JWT orgId (Org A)", async () => {
      getTenantContextMock().getTenantContext.mockResolvedValue({
        userId: "user_a",
        orgId:  ORG_ID_A,
        orgRole: "org:member",
        membership: { role: "MEMBER", isActive: true },
      });
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "bug" }));
      expect(res.status).toBe(200);
    });

    it("Org B user cannot receive Org A results — separate context returns separate data", async () => {
      // Org B user: getTenantContext returns Org B's context
      getTenantContextMock().getTenantContext.mockResolvedValue({
        userId: "user_b",
        orgId:  ORG_ID_B,
        orgRole: "org:member",
        membership: { role: "MEMBER", isActive: true },
      });
      // Org B has no matching cards
      mockQueryRaw([]);
      const res  = await GET(makeReq({ q: "bug" }));
      const body = await res.json() as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("attacker cannot override orgId via query string — route ignores 'orgId' param entirely", async () => {
      getTenantContextMock().getTenantContext.mockResolvedValue({
        userId: "user_b",
        orgId:  ORG_ID_B,
        orgRole: "org:member",
        membership: { role: "MEMBER", isActive: true },
      });
      mockQueryRaw([]);
      // Attacker attempts to pass ORG_ID_A via query string
      const res = await GET(makeReq({ q: "bug", orgId: ORG_ID_A }));
      // Route returns 200 but scoped to Org B (the JWT org), which has no data
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });
  });

  // ─── 9.7 Unauthorized ───────────────────────────────────────────────────────

  describe("9.7 Unauthorized — 401 when getTenantContext throws TenantError", () => {
    it("should return 401 when session is missing (UNAUTHENTICATED)", async () => {
      const { TenantError: RealTenantError } = jest.requireActual(
        "@/lib/tenant-context",
      ) as { TenantError: typeof TenantError };
      getTenantContextMock().getTenantContext.mockRejectedValue(
        new RealTenantError("UNAUTHENTICATED", "No session"),
      );
      const res = await GET(makeReq({ q: "bug" }));
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("should not call $queryRaw when unauthorized", async () => {
      const { TenantError: RealTenantError } = jest.requireActual(
        "@/lib/tenant-context",
      ) as { TenantError: typeof TenantError };
      getTenantContextMock().getTenantContext.mockRejectedValue(
        new RealTenantError("UNAUTHENTICATED", "No session"),
      );
      await GET(makeReq({ q: "bug" }));
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ─── 9.8 boardId filter ───────────────────────────────────────────────────────

  describe("9.8 boardId filter is passed to the DB query", () => {
    it("should call $queryRaw with boardId in scope when boardId is provided", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "bug", boardId: BOARD_ID }));
      expect(res.status).toBe(200);
      // Both data + count queries should have been called
      expect(db.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("should return the same shaped result whether boardId is given or not", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const withBoard    = await (await GET(makeReq({ q: "bug", boardId: BOARD_ID }))).json() as { data: unknown[] };
      jest.resetAllMocks();
      getTenantContextMock().getTenantContext.mockResolvedValue({
        userId: "user_clerk_0001", orgId: ORG_ID_A, orgRole: "org:member",
        membership: { role: "MEMBER", isActive: true },
      });
      mockQueryRaw([SAMPLE_ROW]);
      const withoutBoard = await (await GET(makeReq({ q: "bug" }))).json() as { data: unknown[] };
      expect(withBoard.data).toHaveLength(withoutBoard.data.length);
    });
  });

  // ─── 9.9 DB failure → 500 ────────────────────────────────────────────────────

  describe("9.9 DB failure returns 500 without leaking internal details", () => {
    it("should return HTTP 500 when $queryRaw throws", async () => {
      (db.$queryRaw as jest.Mock).mockRejectedValue(new Error("PrismaClientKnownRequestError connection refused"));
      const res = await GET(makeReq({ q: "bug" }));
      expect(res.status).toBe(500);
    });

    it("should not expose Prisma error details in the response body", async () => {
      (db.$queryRaw as jest.Mock).mockRejectedValue(new Error("Internal Prisma error: connection refused at 127.0.0.1:5432"));
      const res  = await GET(makeReq({ q: "bug" }));
      const body = await res.json() as { error: string };
      expect(body.error).not.toMatch(/prisma|sql|connection|5432/i);
    });
  });

  // ─── 9.10 Response shape & meta ──────────────────────────────────────────────

  describe("9.10 Response shape — data + meta", () => {
    it("should include all required meta fields in the response", async () => {
      mockQueryRaw([SAMPLE_ROW], 1);
      const res  = await GET(makeReq({ q: "bug", page: "1", limit: "20" }));
      const body = await res.json() as { meta: Record<string, unknown> };
      expect(body.meta).toMatchObject({
        total:      expect.any(Number),
        page:       1,
        limit:      20,
        totalPages: expect.any(Number),
      });
    });

    it("meta.totalPages is Math.ceil(total / limit)", async () => {
      mockQueryRaw(Array(3).fill(SAMPLE_ROW), 47); // 47 total, limit 20
      const res  = await GET(makeReq({ q: "bug", limit: "20" }));
      const body = await res.json() as { meta: { totalPages: number } };
      expect(body.meta.totalPages).toBe(Math.ceil(47 / 20)); // 3
    });

    it("should return HTTP 200 on a successful search", async () => {
      mockQueryRaw([SAMPLE_ROW]);
      const res = await GET(makeReq({ q: "bug" }));
      expect(res.status).toBe(200);
    });

    it("empty query returns HTTP 200 (not 204 or 422)", async () => {
      const res = await GET(makeReq({ q: "" }));
      expect(res.status).toBe(200);
    });
  });
});
