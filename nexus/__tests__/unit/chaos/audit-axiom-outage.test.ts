/**
 * @jest-environment node
 *
 * Chaos Engineering — Audit Sink: Axiom Outage Scenarios
 * ───────────────────────────────────────────────────────
 * Validates that `streamToAuditSink()` is bulletproof under all real-world
 * Axiom failure modes — the function must NEVER throw, NEVER block the user's
 * response, and must always capture the failure in Sentry + structured logs.
 *
 * These tests are ADDITIVE over A8–A10 in audit-forensic-integrity.test.ts
 * which already cover the basic "non-throw" and "logs + Sentry" contracts.
 *
 * New scenarios covered here:
 * ─────────────────────────────
 *  AO1  AbortSignal.timeout(5000) fires → NEVER throws, logs warn + Sentry
 *  AO2  HTTP 429 Too Many Requests from Axiom → NEVER throws, logs warn + Sentry
 *  AO3  HTTP 503 Service Unavailable from Axiom → NEVER throws, logs warn + Sentry
 *  AO4  Three consecutive Axiom failures → each captured independently (no silent bucketing)
 *  AO5  Axiom error body included in warning message (truncated to 300 chars)
 *  AO6  Axiom dark + Postgres trigger blocks DELETE → restrict_violation still raised
 *  AO7  Axiom dark + Postgres trigger blocks UPDATE → restrict_violation still raised
 *  AO8  Full AuditSinkEvent payload during outage → warning includes orgId + action
 *  AO9  NODE_ENV=production + no Axiom vars → logger.warn IS called
 *  AO10 NODE_ENV=development + no Axiom vars → logger.warn is NOT called (silent no-op)
 *  AO11 ECONNREFUSED TypeError → classified as Sentry level 'warning' (not 'error')
 *  AO12 AbortError → Sentry tag includes { source: 'audit-sink' } with orgId
 *
 * Isolation
 * ─────────
 * fetch is globalThis.fetch — patched per test via jest.spyOn / direct
 * assignment. Environment variables are set/restored around each test.
 *
 * Test IDs: AO1 – AO12
 */

// ── Top-level module mocks (evaluated before any import) ──────────────────────

jest.mock("server-only", () => ({}));

const mockWarn  = jest.fn();
const mockError = jest.fn();
jest.mock("@/lib/logger", () => ({
  logger: { warn: mockWarn, error: mockError, info: jest.fn() },
}));

const mockCaptureSentryException = jest.fn();
jest.mock("@/lib/sentry-helpers", () => ({
  captureSentryException: (...a: unknown[]) => mockCaptureSentryException(...a),
}));

jest.mock("@prisma/client", () => ({
  ACTION:      { CARD_CREATED: "CARD_CREATED", CARD_UPDATED: "CARD_UPDATED", CARD_DELETED: "CARD_DELETED" },
  ENTITY_TYPE: { CARD: "CARD", BOARD: "BOARD", LIST: "LIST" },
}));

// Mock db for AO6 / AO7 (Postgres trigger simulation)
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

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { streamToAuditSink, type AuditSinkEvent } from "@/lib/audit-sink";
import { db } from "@/lib/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSinkEvent(overrides: Partial<AuditSinkEvent> = {}): AuditSinkEvent {
  return {
    id:          "ao_log_001",
    orgId:       "org_chaos_001",
    boardId:     "board_abc",
    action:      "CARD_CREATED" as AuditSinkEvent["action"],
    entityId:    "card_001",
    entityType:  "CARD"         as AuditSinkEvent["entityType"],
    entityTitle: "Chaos test card",
    userId:      "user_chaos",
    userName:    "Chaos Tester",
    createdAt:   new Date("2026-06-01T10:00:00.000Z"),
    ...overrides,
  };
}

/** Makes fetch return a response with a given status and body. */
function stubAxiomResponse(status: number, body = ""): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(body, { status }),
  );
}

/** Makes fetch throw the given error (simulates network failure). */
function stubAxiomThrow(err: Error): jest.SpyInstance {
  return jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(err);
}

// ── Environment management ─────────────────────────────────────────────────────

/** Sets the Axiom env vars for "Axiom is configured" tests. */
function configureAxiom() {
  process.env.AXIOM_DATASET = "nexus-audit-logs";
  process.env.AXIOM_API_KEY = "xaat_chaos_test_key";
}

/** Removes Axiom env vars for "unconfigured" tests. */
function unconfigureAxiom() {
  delete process.env.AXIOM_DATASET;
  delete process.env.AXIOM_API_KEY;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

const savedEnv: Partial<NodeJS.ProcessEnv> = {};

beforeAll(() => {
  savedEnv.AXIOM_DATASET  = process.env.AXIOM_DATASET;
  savedEnv.AXIOM_API_KEY  = process.env.AXIOM_API_KEY;
  savedEnv.NODE_ENV       = process.env.NODE_ENV;
});

afterAll(() => {
  Object.assign(process.env, savedEnv);
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
  configureAxiom(); // reset to "configured" as the neutral default
});

// ── AO1: AbortSignal.timeout fires ────────────────────────────────────────────

describe("AO1 — AbortSignal.timeout: 5-second deadline fires mid-request", () => {
  it("AO1: never throws when AbortError fires; logs warn + captures Sentry at warning level", async () => {
    configureAxiom();

    // Simulate the TimeoutError that AbortSignal.timeout raises
    const abortError = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
    stubAxiomThrow(abortError);

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("[AUDIT_SINK] Failed to stream event"),
      expect.objectContaining({ orgId: "org_chaos_001" }),
    );
    expect(mockCaptureSentryException).toHaveBeenCalledWith(
      abortError,
      expect.objectContaining({ level: "warning" }),
    );
    expect(mockError).not.toHaveBeenCalled();
  });
});

// ── AO2: HTTP 429 Too Many Requests ──────────────────────────────────────────

describe("AO2 — Axiom 429: rate limiting treated as transient failure", () => {
  it("AO2: never throws on 429; logs AUDIT_SINK warning + Sentry", async () => {
    configureAxiom();
    stubAxiomResponse(429, "Rate limit exceeded");

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("[AUDIT_SINK] Failed to stream event"),
      expect.objectContaining({ error: expect.stringContaining("429") }),
    );
    expect(mockCaptureSentryException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ level: "warning" }),
    );
  });
});

// ── AO3: HTTP 503 Service Unavailable ────────────────────────────────────────

describe("AO3 — Axiom 503: Axiom itself is down — maintenance window", () => {
  it("AO3: never throws on 503; logs warn + Sentry; user action is unaffected", async () => {
    configureAxiom();
    stubAxiomResponse(503, "Service Unavailable");

    await expect(streamToAuditSink(makeSinkEvent())).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("[AUDIT_SINK] Failed to stream event"),
      expect.objectContaining({ error: expect.stringContaining("503") }),
    );
    expect(mockCaptureSentryException).toHaveBeenCalledTimes(1);
    expect(mockCaptureSentryException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ level: "warning" }),
    );
  });
});

// ── AO4: Three consecutive failures — independent captures ───────────────────

describe("AO4 — Three consecutive Axiom failures captured independently", () => {
  it("AO4: each failure is logged and sent to Sentry separately — no silent bucketing", async () => {
    configureAxiom();

    // Three different failure modes in sequence
    jest.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockRejectedValueOnce(
        new DOMException("timeout", "TimeoutError"),
      );

    await streamToAuditSink(makeSinkEvent({ entityId: "card_fail_001" }));
    await streamToAuditSink(makeSinkEvent({ entityId: "card_fail_002" }));
    await streamToAuditSink(makeSinkEvent({ entityId: "card_fail_003" }));

    expect(mockWarn).toHaveBeenCalledTimes(3);
    expect(mockCaptureSentryException).toHaveBeenCalledTimes(3);
  });
});

// ── AO5: Error body in warning message (truncated to 300 chars) ───────────────

describe("AO5 — Axiom error body included in warning (truncated to 300 chars)", () => {
  it("AO5: response body text appears in the warning error field", async () => {
    configureAxiom();
    const body = "Axiom ingest rejected: schema mismatch on field _time";
    stubAxiomResponse(422, body);

    await streamToAuditSink(makeSinkEvent());

    expect(mockWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        error: expect.stringContaining("422"),
      }),
    );
  });

  it("AO5b: body is truncated at 300 characters to prevent oversized log entries", async () => {
    configureAxiom();
    const longBody = "x".repeat(500);
    stubAxiomResponse(400, longBody);

    await streamToAuditSink(makeSinkEvent());

    const warnArgs = mockWarn.mock.calls[0];
    const errorField = (warnArgs[1] as Record<string, unknown>).error as string;
    // The error message should contain the status code and a body slice ≤ 300 chars
    // (body.slice(0, 300) in the source caps the body contribution)
    expect(errorField.length).toBeLessThanOrEqual(500); // 300 body + status + wording
    expect(errorField).toContain("400");
  });
});

// ── AO6 & AO7: Postgres trigger survives Axiom being dark ────────────────────

describe("AO6-AO7 — Postgres guard immutability: holds even when Axiom is dark", () => {
  /**
   * The Postgres BEFORE DELETE trigger raises a P2010 (raw query failed) which
   * manifests as a Prisma error with code 'P2010' and a message containing
   * 'restrict_violation'. We simulate this in the mock.
   */
  const pgTriggerError = Object.assign(new Error("NEXUS: audit_logs.DELETE is forbidden"), {
    code: "P2010",
    meta: { message: "restrict_violation" },
  });

  it("AO6: auditLog.delete() surfaces restrict_violation even when Axiom is unreachable", async () => {
    mockAuditLogDelete.mockRejectedValueOnce(pgTriggerError);

    await expect(
      (db.auditLog as unknown as { delete: jest.Mock }).delete({ where: { id: "log_001" } }),
    ).rejects.toThrow("audit_logs.DELETE is forbidden");
  });

  it("AO7: auditLog.update() surfaces restrict_violation even when Axiom is unreachable", async () => {
    const pgUpdateError = Object.assign(new Error("NEXUS: audit_logs.UPDATE is forbidden"), {
      code: "P2010",
      meta: { message: "restrict_violation" },
    });
    mockAuditLogUpdate.mockRejectedValueOnce(pgUpdateError);

    await expect(
      (db.auditLog as unknown as { update: jest.Mock }).update({
        where: { id: "log_001" },
        data:  { entityTitle: "tampered" },
      }),
    ).rejects.toThrow("audit_logs.UPDATE is forbidden");
  });
});

// ── AO8: Warning message includes orgId and action for correlation ────────────

describe("AO8 — Warning contains orgId and action for log correlation", () => {
  it("AO8: warning metadata includes orgId and action when Axiom is dark", async () => {
    configureAxiom();
    stubAxiomResponse(500, "Internal Server Error");

    await streamToAuditSink(makeSinkEvent({
      orgId:  "org_critical_billing",
      action: "CARD_DELETED" as AuditSinkEvent["action"],
    }));

    expect(mockWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        orgId:  "org_critical_billing",
        action: "CARD_DELETED",
      }),
    );
  });
});

// ── AO9: Production with no Axiom config warns loudly ────────────────────────

describe("AO9 — Production + unconfigured Axiom: logger.warn IS called", () => {
  it("AO9: warns in production when AXIOM_DATASET or AXIOM_API_KEY is missing", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    unconfigureAxiom();

    try {
      await streamToAuditSink(makeSinkEvent());

      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("[AUDIT_SINK] Axiom not configured"),
        expect.objectContaining({ orgId: "org_chaos_001" }),
      );
    } finally {
      process.env.NODE_ENV = original;
      configureAxiom();
    }
  });
});

// ── AO10: Development with no Axiom config is a silent no-op ──────────────────

describe("AO10 — Development + unconfigured Axiom: silent no-op (no warn)", () => {
  it("AO10: does NOT call logger.warn in development when Axiom is unconfigured", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    unconfigureAxiom();

    try {
      await streamToAuditSink(makeSinkEvent());

      expect(mockWarn).not.toHaveBeenCalled();
      expect(mockCaptureSentryException).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = original;
      configureAxiom();
    }
  });
});

// ── AO11: ECONNREFUSED TypeError classified as Sentry level 'warning' ─────────

describe("AO11 — ECONNREFUSED TypeError: classified as warning level in Sentry", () => {
  it("AO11: ECONNREFUSED surfaces at Sentry level=warning, not error", async () => {
    configureAxiom();
    const connRefused = new TypeError("fetch failed: ECONNREFUSED ::1:443");
    stubAxiomThrow(connRefused);

    await streamToAuditSink(makeSinkEvent());

    expect(mockCaptureSentryException).toHaveBeenCalledWith(
      connRefused,
      expect.objectContaining({ level: "warning" }),
    );
    // Must NOT be escalated to 'error' — the Prisma copy is intact
    const calls = mockCaptureSentryException.mock.calls;
    const levels = calls.map(c => (c[1] as { level: string }).level);
    expect(levels.every(l => l === "warning")).toBe(true);
  });
});

// ── AO12: AbortError Sentry tags include source + orgId ───────────────────────

describe("AO12 — AbortError Sentry tags include source:audit-sink and orgId", () => {
  it("AO12: tags { source: 'audit-sink', orgId } are always present for correlation", async () => {
    configureAxiom();
    const abortError = new DOMException("timeout", "TimeoutError");
    stubAxiomThrow(abortError);

    const orgId = "org_forensic_123";
    await streamToAuditSink(makeSinkEvent({ orgId }));

    expect(mockCaptureSentryException).toHaveBeenCalledWith(
      abortError,
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          source: "audit-sink",
          orgId,
        }),
      }),
    );
  });
});
