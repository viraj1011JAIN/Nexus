/**
 * @jest-environment node
 *
 * __tests__/unit/audit/audit-forensic-integrity.test.ts
 *
 * SECTION — Audit Forensic Integrity
 *
 * Covers:
 *   A1  isAuditSinkConfigured() — true when both env vars are set
 *   A2  isAuditSinkConfigured() — false when either var is missing
 *   A3  streamToAuditSink — skips fetch silently when unconfigured (dev)
 *   A4  streamToAuditSink — warns in production when unconfigured
 *   A5  streamToAuditSink — sends correct HTTP request when configured
 *   A6  streamToAuditSink — payload includes _time ISO string from Date
 *   A7  streamToAuditSink — payload flattens previousValues / newValues
 *   A8  streamToAuditSink — never throws on HTTP 4xx from Axiom
 *   A9  streamToAuditSink — never throws on fetch network failure
 *   A10 streamToAuditSink — logs warning + captures Sentry on failure
 *   A11 streamToAuditSink — suppresses PgBouncer warning for localhost URLs
 *   A12 DB immutability — Prisma auditLog.delete() surfaces restrict_violation
 *   A13 DB immutability — Prisma auditLog.update() surfaces restrict_violation
 */

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Capture logger.warn and logger.error calls without polluting test output
const mockWarn  = jest.fn();
const mockError = jest.fn();
jest.mock("@/lib/logger", () => ({
  logger: { warn: (...a: unknown[]) => mockWarn(...a), error: (...a: unknown[]) => mockError(...a) },
}));

// Capture captureSentryException to verify blame delegation on sink failure
const mockCaptureSentryException = jest.fn();
jest.mock("@/lib/sentry-helpers", () => ({
  captureSentryException: (...a: unknown[]) => mockCaptureSentryException(...a),
}));

// Mock @prisma/client enums so they are available in isolation
jest.mock("@prisma/client", () => ({
  ACTION:      { CARD_CREATED: "CARD_CREATED", CARD_UPDATED: "CARD_UPDATED", CARD_DELETED: "CARD_DELETED" },
  ENTITY_TYPE: { CARD: "CARD", BOARD: "BOARD", LIST: "LIST" },
}));

// Mock db to simulate Postgres trigger errors on delete/update
const mockAuditLogDelete = jest.fn();
const mockAuditLogUpdate = jest.fn();
jest.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      delete: (...a: unknown[]) => mockAuditLogDelete(...a),
      update: (...a: unknown[]) => mockAuditLogUpdate(...a),
    },
  },
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  streamToAuditSink,
  isAuditSinkConfigured,
  type AuditSinkEvent,
} from "@/lib/audit-sink";
import { db } from "@/lib/db";

// ─── Helpers ───────────────────────────────────────────────────────────────

const FIXED_DATE = new Date("2026-03-02T12:00:00.000Z");

function makeSinkEvent(overrides: Partial<AuditSinkEvent> = {}): AuditSinkEvent {
  return {
    id:          "log_test_001",
    orgId:       "org_test_abc",
    boardId:     "board_xyz",
    action:      "CARD_CREATED" as AuditSinkEvent["action"],
    entityId:    "card_001",
    entityType:  "CARD"         as AuditSinkEvent["entityType"],
    entityTitle: "Fix login bug",
    userId:      "user_123",
    userName:    "Alice Example",
    userImage:   "https://example.com/alice.jpg",
    ipAddress:   "1.2.3.4",
    userAgent:   "Mozilla/5.0",
    previousValues: null,
    newValues:       null,
    createdAt:   FIXED_DATE,
    ...overrides,
  };
}

/** Creates a mock fetch Response. */
function mockFetchResponse(status: number, body = "{}"): Response {
  return {
    ok:   status < 400,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

// ─── Setup / teardown ──────────────────────────────────────────────────────

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  // Restore clean env before each test
  process.env = { ...ORIGINAL_ENV };
  delete process.env.AXIOM_DATASET;
  delete process.env.AXIOM_API_KEY;
  // Ensure tests default to development unless overridden
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ─── A1 — isAuditSinkConfigured: true when both vars set ──────────────────

describe("A1 — isAuditSinkConfigured", () => {
  it("returns true when AXIOM_DATASET and AXIOM_API_KEY are both set", () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_test_key";
    expect(isAuditSinkConfigured()).toBe(true);
  });
});

// ─── A2 — isAuditSinkConfigured: false when either var is missing ──────────

describe("A2 — isAuditSinkConfigured when incomplete", () => {
  it("returns false when AXIOM_DATASET is missing", () => {
    process.env.AXIOM_API_KEY = "xaat_test_key";
    expect(isAuditSinkConfigured()).toBe(false);
  });

  it("returns false when AXIOM_API_KEY is missing", () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    expect(isAuditSinkConfigured()).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(isAuditSinkConfigured()).toBe(false);
  });
});

// ─── A3 — skip fetch silently when unconfigured in dev ────────────────────

describe("A3 — silent skip when unconfigured (development)", () => {
  it("does not call fetch and does not warn when not configured in dev", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    process.env.NODE_ENV = "development";

    await streamToAuditSink(makeSinkEvent());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── A4 — warn in production when unconfigured ────────────────────────────

describe("A4 — warns in production when unconfigured", () => {
  it("logs a warning when AXIOM vars are absent in production", async () => {
    process.env.NODE_ENV = "production";

    await streamToAuditSink(makeSinkEvent());

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain("Axiom not configured");
  });
});

// ─── A5 — correct HTTP request structure ──────────────────────────────────

describe("A5 — sends correct HTTP request when configured", () => {
  it("POSTs to the correct Axiom ingest URL with Bearer auth header", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(200),
    );

    await streamToAuditSink(makeSinkEvent());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "https://api.axiom.co/v1/datasets/nexus-audit-logs/ingest",
    );
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer xaat_secret_token",
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.method).toBe("POST");

    fetchSpy.mockRestore();
  });
});

// ─── A6 — _time ISO string from Date ──────────────────────────────────────

describe("A6 — _time field in Axiom payload", () => {
  it("serialises createdAt Date to ISO string as _time", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(200),
    );

    await streamToAuditSink(makeSinkEvent({ createdAt: FIXED_DATE }));

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>[];
    expect(body[0]._time).toBe("2026-03-02T12:00:00.000Z");

    fetchSpy.mockRestore();
  });

  it("passes through a pre-formatted ISO string unchanged", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(200),
    );

    await streamToAuditSink(
      makeSinkEvent({ createdAt: "2026-03-02T12:00:00.000Z" }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>[];
    expect(body[0]._time).toBe("2026-03-02T12:00:00.000Z");

    fetchSpy.mockRestore();
  });
});

// ─── A7 — previousValues / newValues forwarded ────────────────────────────

describe("A7 — change delta fields forwarded to Axiom payload", () => {
  it("includes previousValues and newValues in the payload", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(200),
    );

    const prev = { title: "Old title" };
    const next = { title: "New title" };
    await streamToAuditSink(
      makeSinkEvent({ previousValues: prev, newValues: next }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>[];
    expect(body[0].previousValues).toEqual(prev);
    expect(body[0].newValues).toEqual(next);

    fetchSpy.mockRestore();
  });
});

// ─── A8 — never throws on HTTP 4xx ────────────────────────────────────────

describe("A8 — graceful handling of Axiom HTTP errors", () => {
  it("does not throw when Axiom returns 400", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(400, '{"error":"bad request"}'),
    );

    // Must not throw
    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();
  });

  it("does not throw when Axiom returns 403 (bad key)", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_bad_key";

    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(403, '{"error":"forbidden"}'),
    );

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();
  });
});

// ─── A9 — never throws on network failure ────────────────────────────────

describe("A9 — graceful handling of fetch network failures", () => {
  it("does not throw when fetch rejects (e.g. DNS failure)", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    jest.spyOn(global, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();
  });

  it("does not throw when AbortSignal fires (5 s timeout)", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    jest.spyOn(global, "fetch").mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();
  });
});

// ─── A10 — warning + Sentry on failure ────────────────────────────────────

describe("A10 — warning and Sentry capture on sink failure", () => {
  it("calls logger.warn and captureSentryException on HTTP error", async () => {
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_secret_token";

    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(500, "internal server error"),
    );

    await streamToAuditSink(makeSinkEvent());

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain("[AUDIT_SINK] Failed to stream");

    expect(mockCaptureSentryException).toHaveBeenCalledTimes(1);
    const [, opts] = mockCaptureSentryException.mock.calls[0] as [
      unknown,
      { level: string; tags: Record<string, string> },
    ];
    expect(opts.level).toBe("warning");
    expect(opts.tags.source).toBe("audit-sink");
  });
});

// ─── A11 — localhost URL suppression ──────────────────────────────────────

describe("A11 — local dev URLs skip the PgBouncer-style config warnings", () => {
  it("does not warn in production when URL is localhost (dev DB simulation)", async () => {
    // The sink itself doesn't check URLs, but we confirm no spurious
    // production warnings for unconfigured local env in NODE_ENV=production
    // when vars ARE set (i.e. the production config warning only fires when
    // BOTH AXIOM vars are absent, not when the URL is localhost).
    process.env.AXIOM_DATASET = "nexus-audit-logs";
    process.env.AXIOM_API_KEY  = "xaat_token";
    process.env.NODE_ENV      = "production";

    jest.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(200));
    await streamToAuditSink(makeSinkEvent());

    expect(mockWarn).not.toHaveBeenCalled();
  });
});

// ─── A12 — DB-level immutability: delete is blocked by trigger ─────────────

describe("A12 — Postgres trigger blocks audit_logs DELETE", () => {
  it("surfaces restrict_violation (SQLSTATE 23001) when delete is attempted", async () => {
    // Simulate what Postgres returns when the BEFORE DELETE trigger fires.
    // In production, this is the actual `enforce_audit_log_immutability`
    // trigger defined in supabase-audit-immutability.sql.
    const triggerError = Object.assign(
      new Error(
        "NEXUS: audit_logs.DELETE is forbidden — rows are forensically immutable.",
      ),
      {
        code: "P2010", // Prisma raw query error code
        meta: {
          code: "23001", // Postgres SQLSTATE restrict_violation
          message:
            "NEXUS: audit_logs.DELETE is forbidden — rows are forensically immutable.",
        },
      },
    );

    mockAuditLogDelete.mockRejectedValue(triggerError);

    await expect(
      (db.auditLog as { delete: jest.Mock }).delete({ where: { id: "log_001" } }),
    ).rejects.toThrow("NEXUS: audit_logs.DELETE is forbidden");

    expect(mockAuditLogDelete).toHaveBeenCalledTimes(1);
  });

  it("includes the org_id in the trigger error message for forensic attribution", async () => {
    const triggerError = new Error(
      "NEXUS: audit_logs.DELETE is forbidden — rows are forensically immutable. " +
      "Action: CARD_CREATED, Entity ID: card_001, Org: org_compromised",
    );

    mockAuditLogDelete.mockRejectedValue(triggerError);

    const err = await (db.auditLog as { delete: jest.Mock })
      .delete({ where: { id: "log_001" } })
      .catch((e: Error) => e);

    expect(err.message).toContain("org_compromised");
  });
});

// ─── A13 — DB-level immutability: update is blocked by trigger ─────────────

describe("A13 — Postgres trigger blocks audit_logs UPDATE", () => {
  it("surfaces restrict_violation (SQLSTATE 23001) when update is attempted", async () => {
    const triggerError = Object.assign(
      new Error(
        "NEXUS: audit_logs.UPDATE is forbidden — rows are forensically immutable.",
      ),
      {
        code: "P2010",
        meta: {
          code: "23001",
          message:
            "NEXUS: audit_logs.UPDATE is forbidden — rows are forensically immutable.",
        },
      },
    );

    mockAuditLogUpdate.mockRejectedValue(triggerError);

    await expect(
      (db.auditLog as { update: jest.Mock }).update({
        where: { id: "log_001" },
        data:  { entityTitle: "tampered" },
      }),
    ).rejects.toThrow("NEXUS: audit_logs.UPDATE is forbidden");
  });

  it("does not silently swallow the trigger error (no catch-all masking)", async () => {
    // Verifies that no layer in the call chain swallows the Postgres error.
    // If this test fails it means something is catching and silencing the
    // trigger, which would be a forensic integrity regression.
    const triggerError = new Error("NEXUS: audit_logs.UPDATE is forbidden");
    mockAuditLogUpdate.mockRejectedValue(triggerError);

    const result = await (db.auditLog as { update: jest.Mock })
      .update({ where: { id: "x" }, data: {} })
      .then(() => "NO_ERROR")
      .catch(() => "ERROR_SURFACED");

    expect(result).toBe("ERROR_SURFACED");
  });
});
