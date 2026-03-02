/**
 * @jest-environment node
 *
 * Chaos Engineering — Step-Up Auth: Network Partition Scenarios
 * ──────────────────────────────────────────────────────────────
 * Simulates network-level failures between NEXUS and Clerk's verification
 * API and proves that `createStepUpAction` fails safely under every
 * partition scenario.
 *
 * These tests are ADDITIVE over S1–S20 in step-up-action.test.ts.
 * S17 already covers the basic "auth.protect() throws → propagates" case.
 * These chaos tests cover the more subtle timing, concurrency, and
 * function-isolation properties that matter in a production incident.
 *
 * New scenarios covered here:
 * ─────────────────────────────
 *  NP1  auth.protect() rejects (network error) → propagates immediately, no hang
 *  NP2  auth.protect() slow then resolves → action proceeds normally after delay
 *  NP3  Network drops AFTER has() passes → handler is still called (correct)
 *  NP4  auth.protect() rejection → reverificationError is NEVER called
 *  NP5  auth.protect() rejection → handler is NEVER called
 *  NP6  Zod validation error returned cleanly when network is intermittent
 *  NP7  Rapid sequential calls: one partition doesn't bleed into successful calls
 *  NP8  has() itself throws (internal Clerk error) → propagates as unhandled
 *  NP9  Billing context: reject before handler means no charge side-effect
 *  NP10 Concurrent step-up actions: one partition doesn't affect parallel calls
 *
 * Test IDs: NP1 – NP10
 */

// ── Module mocks ───────────────────────────────────────────────────────────────

jest.mock("server-only", () => ({}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: jest.fn(),
  },
  reverificationError: jest.fn((level: string) => ({
    __clerk_reverification_required: true,
    level,
  })),
}));

jest.mock("@/lib/tenant-context", () => {
  class TenantError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
      this.name = "TenantError";
    }
  }
  return { TenantError };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { createStepUpAction } from "@/lib/step-up-action";
import { auth, reverificationError } from "@clerk/nextjs/server";
import { z } from "zod";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TestSchema = z.object({ id: z.string().cuid() });
const BillingSchema = z.object({ priceId: z.string().min(1) });
const VALID_CUID = "clh6p5rj80000qz6k3gbbxxx1";

/** Simulates a successful Clerk session where has() returns true. */
function mockProtectSuccess() {
  (auth.protect as jest.Mock).mockResolvedValue({
    has: jest.fn().mockReturnValue(true),
  });
}

/** Simulates auth.protect() rejecting with a network error. */
function mockProtectNetworkError(message = "fetch failed: ECONNRESET") {
  (auth.protect as jest.Mock).mockRejectedValue(new TypeError(message));
}

/** Simulates auth.protect() taking `delayMs` milliseconds before resolving. */
function mockProtectSlowSuccess(delayMs: number) {
  (auth.protect as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(
          () => resolve({ has: jest.fn().mockReturnValue(true) }),
          delayMs,
        ),
      ),
  );
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NP1 — auth.protect() network rejection propagates immediately, no hang", () => {
  it("NP1: rejects with the original network error; does not hang or swallow the error", async () => {
    mockProtectNetworkError("fetch failed: ECONNRESET while verifying step-up token");
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));

    await expect(action({ id: VALID_CUID })).rejects.toThrow(
      "fetch failed: ECONNRESET while verifying step-up token",
    );
  });
});

describe("NP2 — auth.protect() slow (network latency) then resolves: action proceeds", () => {
  it("NP2: action completes successfully after a 200ms Clerk API delay", async () => {
    mockProtectSlowSuccess(200);
    const handler = jest.fn().mockResolvedValue({ data: "completed" });
    const action = createStepUpAction(TestSchema, handler);

    const result = await action({ id: VALID_CUID });

    expect(result).toEqual({ data: "completed" });
    expect(handler).toHaveBeenCalledTimes(1);
  }, 3_000);
});

describe("NP3 — Network drops AFTER has() passes: handler is still invoked", () => {
  it("NP3: has() returning true means the handler runs, even if line drops mid-call", async () => {
    // has() already verified → has() returns true; simulating that the network
    // dropped AFTER that verification is not observable here (the has() call
    // already returned). What we assert: when has() returns true, handler runs.
    mockProtectSuccess();
    const handler = jest.fn().mockResolvedValue({ data: "executed" });
    const action = createStepUpAction(TestSchema, handler);

    const result = await action({ id: VALID_CUID });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: "executed" });
  });
});

describe("NP4 — auth.protect() rejection: reverificationError is NEVER called", () => {
  it("NP4: when auth.protect() throws, reverificationError must not be invoked", async () => {
    mockProtectNetworkError();
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));

    await expect(action({ id: VALID_CUID })).rejects.toThrow(TypeError);

    expect(reverificationError).not.toHaveBeenCalled();
  });
});

describe("NP5 — auth.protect() rejection: business-logic handler is NEVER called", () => {
  it("NP5: when auth.protect() throws, the handler is never executed", async () => {
    mockProtectNetworkError();
    const handler = jest.fn().mockResolvedValue({ data: "ok" });
    const action = createStepUpAction(TestSchema, handler);

    await expect(action({ id: VALID_CUID })).rejects.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("NP6 — Zod validation errors return cleanly during intermittent network", () => {
  it("NP6a: invalid input produces fieldErrors even when auth.protect() is intermittent", async () => {
    // auth.protect() succeeds (network is intermittent, not fully down)
    mockProtectSuccess();
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));

    // Invalid CUID → should receive fieldErrors, not a network error
    const result = await action({ id: "not-a-valid-cuid" });

    expect(result).toHaveProperty("fieldErrors.id");
    expect(result).not.toHaveProperty("error");
  });

  it("NP6b: after a network partition, a fresh call with invalid input returns fieldErrors", async () => {
    // First call: partition
    mockProtectNetworkError();
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    await expect(action({ id: VALID_CUID })).rejects.toThrow();

    // Second call: network recovers; Zod validation path still works
    mockProtectSuccess();
    const result = await action({ id: "bad" });
    expect(result).toHaveProperty("fieldErrors.id");
  });
});

describe("NP7 — Sequential calls: one partition does not poison subsequent calls", () => {
  it("NP7: a failed call is isolated — the next call with a healthy session succeeds", async () => {
    const action = createStepUpAction(TestSchema, async () => ({ data: "success" }));

    // Call 1: partition
    (auth.protect as jest.Mock).mockRejectedValueOnce(
      new TypeError("ETIMEDOUT connecting to Clerk"),
    );
    await expect(action({ id: VALID_CUID })).rejects.toThrow("ETIMEDOUT");

    // Call 2: recovered session — must succeed independently
    (auth.protect as jest.Mock).mockResolvedValueOnce({
      has: jest.fn().mockReturnValue(true),
    });
    const handler2 = jest.fn().mockResolvedValue({ data: "success" });
    const action2 = createStepUpAction(TestSchema, handler2);
    const result = await action2({ id: VALID_CUID });

    expect(result).toEqual({ data: "success" });
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

describe("NP8 — has() itself throws (internal Clerk SDK error): propagates as unhandled", () => {
  it("NP8: if has() throws internally, the error propagates up to the caller", async () => {
    // auth.protect() resolves, but the returned has() function throws
    const internalClerkError = new Error("Clerk SDK internal: malformed JWT claims");
    (auth.protect as jest.Mock).mockResolvedValue({
      has: jest.fn().mockImplementation(() => {
        throw internalClerkError;
      }),
    });
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));

    await expect(action({ id: VALID_CUID })).rejects.toThrow(
      "Clerk SDK internal: malformed JWT claims",
    );
  });
});

describe("NP9 — Billing context: handler (charge) is never invoked when auth.protect() rejects", () => {
  it("NP9: checkout handler is NOT called when Clerk is unreachable (no accidental billing)", async () => {
    mockProtectNetworkError("fetch failed: Clerk API unreachable");

    const billingHandler = jest.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/test_session" },
    });
    const billingAction = createStepUpAction(BillingSchema, billingHandler, "moderate");

    await expect(
      billingAction({ priceId: "price_pro_monthly" }),
    ).rejects.toThrow("Clerk API unreachable");

    // Critical: no billing side-effect must have occurred
    expect(billingHandler).not.toHaveBeenCalled();
  });
});

describe("NP10 — Concurrent step-up actions: one partition is isolated to its own call", () => {
  it("NP10: two concurrent actions where only one has a Clerk partition", async () => {
    // Action A succeeds, Action B's Clerk call fails (partition)
    const actionAHandler = jest.fn().mockResolvedValue({ data: "board_a_deleted" });
    const actionBHandler = jest.fn().mockResolvedValue({ data: "board_b_deleted" });

    const actionA = createStepUpAction(TestSchema, actionAHandler);
    const actionB = createStepUpAction(TestSchema, actionBHandler);

    // auth.protect() calls: first resolves (A), second rejects (B)
    (auth.protect as jest.Mock)
      .mockResolvedValueOnce({ has: jest.fn().mockReturnValue(true) })     // A: healthy
      .mockRejectedValueOnce(new TypeError("ECONNRESET for org_b"));       // B: partitioned

    const [resultA, resultB] = await Promise.allSettled([
      actionA({ id: VALID_CUID }),
      actionB({ id: VALID_CUID }),
    ]);

    // Action A: should have succeeded without issue
    expect(resultA.status).toBe("fulfilled");
    if (resultA.status === "fulfilled") {
      expect(resultA.value).toEqual({ data: "board_a_deleted" });
    }
    expect(actionAHandler).toHaveBeenCalledTimes(1);

    // Action B: should have rejected with the network error
    expect(resultB.status).toBe("rejected");
    if (resultB.status === "rejected") {
      expect(resultB.reason).toBeInstanceOf(TypeError);
      expect(resultB.reason.message).toContain("ECONNRESET for org_b");
    }
    expect(actionBHandler).not.toHaveBeenCalled();
  });
});
