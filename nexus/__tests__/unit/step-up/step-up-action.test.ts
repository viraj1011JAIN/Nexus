/**
 * createStepUpAction — unit tests
 *
 * 20 tests covering every branch of the step-up auth factory:
 *
 *   Gate 1 — reverification check (S1–S4, S11, S14–S17)
 *   Gate 2 — Zod schema validation (S5–S6)
 *   Gate 3 — handler business logic + error handling (S7–S10, S12–S13)
 *   Constants (S18–S20)
 *
 * All Clerk APIs and TenantError are fully mocked — no real auth or DB calls.
 */

// ── Module mocks (must precede all imports) ──────────────────────────────────

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

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  createStepUpAction,
  STEP_UP_PROTECTED_ACTIONS,
  type StepUpLevel,
} from "@/lib/step-up-action";
import { auth, reverificationError } from "@clerk/nextjs/server";
import { TenantError } from "@/lib/tenant-context";
import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TestSchema = z.object({ id: z.string().cuid() });
const VALID_CUID = "clh6p5rj80000qz6k3gbbxxx1";

/**
 * Configures auth.protect() to return the supplied `hasResult` for the
 * `has({ reverification })` call.
 */
function mockAuthProtect(hasResult: boolean) {
  (auth.protect as jest.Mock).mockResolvedValue({
    has: jest.fn().mockReturnValue(hasResult),
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("createStepUpAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Gate 1: Reverification ─────────────────────────────────────────────────

  it("S1: returns reverificationError when has() is false (session stale)", async () => {
    mockAuthProtect(false);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    const result = await action({ id: VALID_CUID });
    expect(result).toHaveProperty("__clerk_reverification_required", true);
  });

  it("S2: calls handler when has() is true (session fresh)", async () => {
    mockAuthProtect(true);
    const handler = jest.fn().mockResolvedValue({ data: "success" });
    const action = createStepUpAction(TestSchema, handler);
    const result = await action({ id: VALID_CUID });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: "success" });
  });

  it("S3: passes the configured level to reverificationError", async () => {
    mockAuthProtect(false);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }), "strict_mfa");
    await action({ id: VALID_CUID });
    expect(reverificationError).toHaveBeenCalledWith("strict_mfa");
  });

  it("S4: does NOT call reverificationError when has() passes", async () => {
    mockAuthProtect(true);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    await action({ id: VALID_CUID });
    expect(reverificationError).not.toHaveBeenCalled();
  });

  // ── Gate 2: Zod validation ─────────────────────────────────────────────────

  it("S5: returns fieldErrors when input fails Zod validation", async () => {
    mockAuthProtect(true);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    // An empty string is not a valid CUID
    const result = await action({ id: "" });
    expect(result).toHaveProperty("fieldErrors.id");
  });

  it("S6: does NOT call handler when Zod validation fails", async () => {
    mockAuthProtect(true);
    const handler = jest.fn().mockResolvedValue({ data: "ok" });
    const action = createStepUpAction(TestSchema, handler);
    await action({ id: "not-a-cuid" });
    expect(handler).not.toHaveBeenCalled();
  });

  // ── Gate 3: Handler result + TenantError mapping ───────────────────────────

  it("S7: maps TenantError UNAUTHENTICATED to a safe message", async () => {
    mockAuthProtect(true);
    const action = createStepUpAction(TestSchema, async () => {
      throw new TenantError("UNAUTHENTICATED");
    });
    const result = await action({ id: VALID_CUID });
    expect(result).toHaveProperty("error", "You must be signed in to perform this action.");
  });

  it("S8: maps TenantError FORBIDDEN to a safe message", async () => {
    mockAuthProtect(true);
    const action = createStepUpAction(TestSchema, async () => {
      throw new TenantError("FORBIDDEN");
    });
    const result = await action({ id: VALID_CUID });
    expect(result).toHaveProperty("error", "You do not have permission to perform this action.");
  });

  it("S9: maps TenantError NOT_FOUND to a safe message", async () => {
    mockAuthProtect(true);
    const action = createStepUpAction(TestSchema, async () => {
      throw new TenantError("NOT_FOUND");
    });
    const result = await action({ id: VALID_CUID });
    expect(result).toHaveProperty("error", "The requested resource was not found.");
  });

  it("S10: re-throws unexpected (non-TenantError) exceptions unmodified", async () => {
    mockAuthProtect(true);
    const err = new Error("DB connection lost");
    const action = createStepUpAction(TestSchema, async () => {
      throw err;
    });
    await expect(action({ id: VALID_CUID })).rejects.toThrow("DB connection lost");
  });

  it("S11: always calls auth.protect() regardless of other conditions", async () => {
    mockAuthProtect(false);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    await action({ id: VALID_CUID });
    expect(auth.protect).toHaveBeenCalledTimes(1);
  });

  it("S12: handler receives fully-validated, typed data (not raw input)", async () => {
    mockAuthProtect(true);
    const capturedArgs: unknown[] = [];
    const action = createStepUpAction(TestSchema, async (input) => {
      capturedArgs.push(input);
      return { data: "ok" };
    });
    await action({ id: VALID_CUID });
    expect(capturedArgs[0]).toEqual({ id: VALID_CUID });
  });

  it("S13: successful handler result is passed through unchanged to the caller", async () => {
    mockAuthProtect(true);
    const payload = { id: "board_abc", title: "Q4 Roadmap" };
    const action = createStepUpAction(TestSchema, async () => ({ data: payload }));
    const result = await action({ id: VALID_CUID });
    expect(result).toEqual({ data: payload });
  });

  // ── Level configuration ────────────────────────────────────────────────────

  it("S14: default level is 'strict' (passed to has() when no level argument)", async () => {
    const hasMock = jest.fn().mockReturnValue(false);
    (auth.protect as jest.Mock).mockResolvedValue({ has: hasMock });
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    await action({ id: VALID_CUID });
    expect(hasMock).toHaveBeenCalledWith({ reverification: "strict" });
  });

  it("S15: custom level 'moderate' is passed to has() and reverificationError()", async () => {
    const hasMock = jest.fn().mockReturnValue(false);
    (auth.protect as jest.Mock).mockResolvedValue({ has: hasMock });
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }), "moderate");
    await action({ id: VALID_CUID });
    expect(hasMock).toHaveBeenCalledWith({ reverification: "moderate" });
    expect(reverificationError).toHaveBeenCalledWith("moderate");
  });

  it("S16: 'strict_mfa' level is fully supported end-to-end", async () => {
    const hasMock = jest.fn().mockReturnValue(false);
    (auth.protect as jest.Mock).mockResolvedValue({ has: hasMock });
    const action = createStepUpAction(
      TestSchema,
      async () => ({ data: "ok" }),
      "strict_mfa" as StepUpLevel,
    );
    await action({ id: VALID_CUID });
    expect(hasMock).toHaveBeenCalledWith({ reverification: "strict_mfa" });
    expect(reverificationError).toHaveBeenCalledWith("strict_mfa");
  });

  it("S17: auth.protect() throwing propagates up (unauthenticated session)", async () => {
    (auth.protect as jest.Mock).mockRejectedValue(
      new Error("Unauthenticated: no active Clerk session"),
    );
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    await expect(action({ id: VALID_CUID })).rejects.toThrow(
      "Unauthenticated: no active Clerk session",
    );
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  it("S18: STEP_UP_PROTECTED_ACTIONS contains the three expected entries", () => {
    expect(STEP_UP_PROTECTED_ACTIONS).toContain("DELETE_BOARD");
    expect(STEP_UP_PROTECTED_ACTIONS).toContain("BILLING_CHECKOUT");
    expect(STEP_UP_PROTECTED_ACTIONS).toContain("BILLING_PORTAL");
    expect(STEP_UP_PROTECTED_ACTIONS).toHaveLength(3);
  });

  it("S19: 'moderate' level — handler is invoked when has() returns true", async () => {
    const hasMock = jest.fn().mockReturnValue(true); // window still fresh
    (auth.protect as jest.Mock).mockResolvedValue({ has: hasMock });
    const handler = jest.fn().mockResolvedValue({ data: { url: "https://checkout.stripe.com/xyz" } });
    const action = createStepUpAction(TestSchema, handler, "moderate");
    const result = await action({ id: VALID_CUID });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: { url: "https://checkout.stripe.com/xyz" } });
    expect(reverificationError).not.toHaveBeenCalled();
  });

  it("S20: reverificationError return value is an opaque Clerk object, not a plain ActionState error", async () => {
    mockAuthProtect(false);
    const action = createStepUpAction(TestSchema, async () => ({ data: "ok" }));
    const result = await action({ id: VALID_CUID });
    // Must NOT look like an ActionState error — client-side useReverification
    // detects the __clerk_reverification_required shape to show the modal
    expect(result).not.toHaveProperty("error");
    expect(result).not.toHaveProperty("fieldErrors");
    expect(result).toHaveProperty("__clerk_reverification_required");
  });
});
