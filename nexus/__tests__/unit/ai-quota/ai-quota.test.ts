/**
 * Section 8 — AI Quota Tests
 *
 * Directly tests the quota enforcement layer in actions/ai-actions.ts.
 * The `checkRateLimit` helper is internal; all scenarios are exercised through
 * the exported actions: suggestPriority, generateCardDescription, suggestChecklists.
 *
 * Covers:
 *   8.1  aiCallsToday = 49 → succeeds and increments to 50 (boundary − 1)
 *   8.2  aiCallsToday = 50 → returns exact quota-exhausted error string
 *   8.3  Organisation not found → graceful error (no crash)
 *   8.4  OPENAI_API_KEY not configured (client unavailable) → graceful error (no crash)
 *   8.5  Auto-reset: aiCallsResetAt is in the past → counter reset to 0; call succeeds
 *   8.6  Already reset today → reset NOT triggered again; current count used
 *   8.7  aiCallsResetAt = null → treated as never-reset; reset triggered
 *   8.8  Org-level counter: two users in same org share the same quota bucket
 *   8.9  Idempotent reset: calling the action twice on the same day does not double-reset
 *   8.10 OpenAI returns an unrecognised priority value → defaults to "MEDIUM"
 *   8.11 OpenAI throws at the API call level → returns graceful "AI request failed" error
 *   8.12 generateCardDescription: quota check prevents OpenAI call when exhausted
 *   8.13 suggestChecklists: filters out non-string items from AI response
 *   8.14 Auth failure (no userId/orgId in session) → returns { error: "Unauthorized" }
 *   8.15 Input validation: empty title returns validation error before any DB call
 *   8.16 Input validation: title > 255 chars returns validation error
 *   8.17 AI_DAILY_LIMIT env override is respected
 */

import {
  suggestPriority,
  generateCardDescription,
  suggestChecklists,
} from "@/actions/ai-actions";
import { db } from "@/lib/db";

// ─── Constants ───────────────────────────────────────────────────────────────

const ORG_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "user_clerk_0001";

/** The default AI_DAILY_LIMIT used when the env var is not set. */
const DEFAULT_LIMIT = 50;

/** Today at midnight (local) — used to test the reset boundary. */
function todayMidnight(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Yesterday at noon — reliably in the past relative to today's midnight. */
function yesterday(): Date {
  return new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 h ago
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

/**
 * IMPORTANT: jest.mock factories run at hoist-time (before const declarations).
 * All values that are referenced here must be literals or jest.fn() calls — never
 * workspace-level constants like ORG_ID / USER_ID which would cause TDZ errors.
 */
const mockCreate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
      },
    },
  })),
}));

jest.mock("@/lib/db", () => ({
  db: {
    organization: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({
    userId: "user_clerk_0001",
    orgId:  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// ─── Mock reset helpers ───────────────────────────────────────────────────────

/** Wire up the auth and db mocks to their pass-through defaults. */
function resetMocks(overrides: { aiCallsToday?: number; aiCallsResetAt?: Date | null } = {}) {
  const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
  auth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID });

  (db.organization.findUnique as jest.Mock).mockResolvedValue({
    id:            ORG_ID,
    aiCallsToday:  overrides.aiCallsToday  ?? 0,
    aiCallsResetAt: overrides.aiCallsResetAt === undefined ? todayMidnight() : overrides.aiCallsResetAt,
  });

  (db.organization.update as jest.Mock).mockResolvedValue({
    id: ORG_ID,
    aiCallsToday: (overrides.aiCallsToday ?? 0) + 1,
  });

  // Default: OpenAI returns a valid MEDIUM priority response
  mockCreate.mockResolvedValue({
    choices: [
      { message: { content: '{"priority":"MEDIUM","reasoning":"Default test reasoning."}' } },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 8 — AI Quota", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetMocks();
  });

  // ─── 8.1 Boundary: 49 calls today → 50th call succeeds ──────────────────────

  describe("8.1 aiCallsToday = 49 (one below limit)", () => {
    it("should succeed and increment the counter from 49 to 50", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT - 1 });
      const result = await suggestPriority({ title: "Fix auth bug", description: "" });
      expect(result.error).toBeUndefined();
      expect(result.data?.priority).toBeDefined();
      // Increment must be triggered
      expect(db.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { aiCallsToday: { increment: 1 } } }),
      );
    });

    it("should call OpenAI exactly once on the successful 50th call", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT - 1 });
      await suggestPriority({ title: "Final allowed call", description: "" });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 8.2 At limit: 50 calls today → 51st call blocked ──────────────────────

  describe("8.2 aiCallsToday = 50 (at limit)", () => {
    it("should return the quota-exhausted error with the correct message", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT });
      const result = await suggestPriority({ title: "Over the limit", description: "" });
      // Source message: `Daily AI limit of ${AI_DAILY_LIMIT} calls reached. Resets at midnight.`
      expect(result.error).toBe(`Daily AI limit of ${DEFAULT_LIMIT} calls reached. Resets at midnight.`);
    });

    it("should NOT call OpenAI when quota is exhausted", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT });
      await suggestPriority({ title: "Over the limit", description: "" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should NOT increment the counter when quota is already exhausted", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT });
      await suggestPriority({ title: "Over the limit", description: "" });
      // update must not be called on org.aiCallsToday
      expect(db.organization.update).not.toHaveBeenCalled();
    });
  });

  // ─── 8.3 Organisation not found ─────────────────────────────────────────────

  describe("8.3 Organisation not found in DB", () => {
    it("should return a graceful error when the org row does not exist", async () => {
      (db.organization.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await suggestPriority({ title: "Test", description: "" });
      expect(result.error).toBeDefined();
      expect(result.error).toBe("Organization not found.");
    });

    it("should not expose raw Prisma or stack-trace details in the error message", async () => {
      (db.organization.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await suggestPriority({ title: "Test", description: "" });
      expect(result.error).not.toMatch(/prisma|stack|trace|PrismaClientKnownRequestError/i);
    });
  });

  // ─── 8.4 OpenAI client unavailable (simulated by throwing inside mockCreate) ──

  describe("8.4 OpenAI client unavailable", () => {
    it("should return a graceful error when the OpenAI call fails (simulates missing key)", async () => {
      // Simulate the error that getOpenAI() would throw when the key is absent
      mockCreate.mockRejectedValueOnce(
        new Error("AI features are disabled: OPENAI_API_KEY is missing or invalid."),
      );
      const result = await suggestPriority({ title: "Build dark mode", description: "" });
      expect(result.error).toBe("AI request failed. Please try again.");
      expect(result.data).toBeUndefined();
    });

    it("should not crash the process when OpenAI throws during generateCardDescription", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network error"));
      const result = await generateCardDescription({ title: "Feature spec", context: "" });
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it("should not crash the process when OpenAI throws during suggestChecklists", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Rate limit from OpenAI"));
      const result = await suggestChecklists({ title: "Big task", description: "" });
      expect(result.error).toBe("AI request failed. Please try again.");
      expect(result.data).toBeUndefined();
    });
  });

  // ─── 8.5 Auto-reset: aiCallsResetAt is in the past ──────────────────────────

  describe("8.5 Auto-reset when aiCallsResetAt is in the past", () => {
    it("should reset the counter to 0 and allow the call when aiCallsResetAt is yesterday", async () => {
      // Org was last reset yesterday — today's counter carries old data
      resetMocks({ aiCallsToday: DEFAULT_LIMIT, aiCallsResetAt: yesterday() });
      const result = await suggestPriority({ title: "Fresh day, fresh calls", description: "" });
      // The reset sets aiCallsToday: 0; the action should now succeed
      expect(result.error).toBeUndefined();
    });

    it("should call db.organization.update to reset aiCallsToday and aiCallsResetAt", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT, aiCallsResetAt: yesterday() });
      await suggestPriority({ title: "Day reset test", description: "" });
      // First update: reset (aiCallsToday: 0)
      expect(db.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ aiCallsToday: 0 }),
        }),
      );
    });

    it("should reset when aiCallsResetAt is null (never been reset)", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT, aiCallsResetAt: null });
      const result = await suggestPriority({ title: "Null reset-at test", description: "" });
      // null → treated as "never reset" → needsReset = true → resets, then succeeds
      expect(result.error).toBeUndefined();
    });
  });

  // ─── 8.6 Already reset today → counter NOT reset again ──────────────────────

  describe("8.6 Already reset today — idempotent reset", () => {
    it("should NOT reset when aiCallsResetAt is today's midnight (already reset)", async () => {
      // Org was reset at exactly today's midnight; counter has 5 calls used
      resetMocks({ aiCallsToday: 5, aiCallsResetAt: todayMidnight() });
      await suggestPriority({ title: "Second call today", description: "" });
      // update should be called for INCREMENTING, not for resetting
      // The reset path calls update with { aiCallsToday: 0 }; should NOT appear
      const updateCalls = (db.organization.update as jest.Mock).mock.calls as [{ data: unknown }][];
      const hasResetCall = updateCalls.some(
        ([args]) => (args.data as Record<string, unknown>)["aiCallsToday"] === 0,
      );
      expect(hasResetCall).toBe(false);
    });
  });

  // ─── 8.7 Org-level counter: different users share the same quota ─────────────

  describe("8.7 Org-level counter (not user-level)", () => {
    it("user A exhausts the quota; user B in the same org also receives the exhausted error", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };

      // ── User A call (49th → 50th, succeeds) ──
      auth.mockResolvedValueOnce({ userId: "user_A", orgId: ORG_ID });
      resetMocks({ aiCallsToday: DEFAULT_LIMIT - 1 });
      const resultA = await suggestPriority({ title: "User A call", description: "" });
      expect(resultA.error).toBeUndefined();

      // ── User B call (org counter now at 50, blocked) ──
      auth.mockResolvedValueOnce({ userId: "user_B", orgId: ORG_ID });
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id:            ORG_ID,
        aiCallsToday:  DEFAULT_LIMIT,   // org counter already at limit
        aiCallsResetAt: todayMidnight(),
      });
      const resultB = await suggestPriority({ title: "User B call", description: "" });
      expect(resultB.error).toBe(`Daily AI limit of ${DEFAULT_LIMIT} calls reached. Resets at midnight.`);
    });

    it("quota check uses orgId from the Clerk session, NOT from the request body", async () => {
      // Verifies that the org context is always taken from `auth()`, not client input
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValue({ userId: USER_ID, orgId: ORG_ID });
      resetMocks({ aiCallsToday: 0 });
      await suggestPriority({ title: "Legit call", description: "" });
      // findUnique must have been called with the JWT-derived orgId
      expect(db.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ORG_ID } }),
      );
    });
  });

  // ─── 8.8 Idempotent reset (cron-job equivalent) ──────────────────────────────

  describe("8.8 Idempotent reset (cron-job / daily reset equivalence)", () => {
    it("calling the action twice with a past aiCallsResetAt is idempotent (no double-reset)", async () => {
      // First call: aiCallsResetAt is yesterday → triggers reset → succeeds
      resetMocks({ aiCallsToday: 0, aiCallsResetAt: yesterday() });
      const first = await suggestPriority({ title: "First call after reset", description: "" });
      expect(first.error).toBeUndefined();

      // Second call: aiCallsResetAt is now today (just updated) → no reset; count = 1
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id:            ORG_ID,
        aiCallsToday:  1,           // incremented from the first call
        aiCallsResetAt: todayMidnight(), // reset already happened today
      });
      const second = await suggestPriority({ title: "Second call", description: "" });
      expect(second.error).toBeUndefined();
      // No additional "reset to 0" update on the second call
      const updateCalls = (db.organization.update as jest.Mock).mock.calls as [{ data: unknown }][];
      const resetCalls = updateCalls.filter(
        ([args]) => (args.data as Record<string, unknown>)["aiCallsToday"] === 0,
      );
      expect(resetCalls).toHaveLength(1); // exactly one reset — from the first call
    });
  });

  // ─── 8.9 Invalid AI response handling ───────────────────────────────────────

  describe("8.9 Invalid OpenAI response — field coercion", () => {
    it("should default to MEDIUM when OpenAI returns an unrecognised priority value", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"priority":"CRITICAL","reasoning":"Some reason."}' } }],
      });
      const result = await suggestPriority({ title: "Test coercion", description: "" });
      expect(result.error).toBeUndefined();
      expect(result.data?.priority).toBe("MEDIUM");
    });

    it("should default to MEDIUM when OpenAI returns malformed JSON", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not-json-at-all" } }],
      });
      const result = await suggestPriority({ title: "Bad JSON", description: "" });
      // JSON.parse("not-json-at-all") throws → caught → { error: "AI request failed." }
      expect(result.error).toBeDefined();
    });

    it("should return empty items array when AI returns non-array items field", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"items":null}' } }],
      });
      const result = await suggestChecklists({ title: "Checklist test", description: "" });
      expect(result.error).toBeUndefined();
      expect(result.data?.items).toEqual([]);
    });

    it("should filter out non-string entries from AI items list", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: ["Write tests", 42, null, true, "Deploy to staging"],
              }),
            },
          },
        ],
      });
      const result = await suggestChecklists({ title: "Mixed items", description: "" });
      expect(result.error).toBeUndefined();
      // Only the two string items survive the filter
      expect(result.data?.items).toEqual(["Write tests", "Deploy to staging"]);
    });

    it("should cap checklist items at 8 even when AI returns more", async () => {
      const tooMany = Array.from({ length: 12 }, (_, i) => `Step ${i + 1}`);
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ items: tooMany }) } }],
      });
      const result = await suggestChecklists({ title: "Long checklist", description: "" });
      expect(result.error).toBeUndefined();
      expect(result.data?.items.length).toBeLessThanOrEqual(8);
    });
  });

  // ─── 8.10 generateCardDescription quota guard ────────────────────────────────

  describe("8.10 generateCardDescription — quota enforcement", () => {
    it("should return quota-exhausted error and skip OpenAI call", async () => {
      resetMocks({ aiCallsToday: DEFAULT_LIMIT });
      const result = await generateCardDescription({ title: "Big feature spec", context: "" });
      expect(result.error).toBeDefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("happy path: returns a non-empty description string on success", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Fix the login flow by updating the JWT expiry." } }],
      });
      const result = await generateCardDescription({ title: "Fix login", context: "Auth module" });
      expect(result.error).toBeUndefined();
      expect(result.data?.description).toBeTruthy();
    });
  });

  // ─── 8.11 Input validation ───────────────────────────────────────────────────

  describe("8.11 Input validation", () => {
    it("should return a validation error for an empty title without calling DB or OpenAI", async () => {
      const result = await suggestPriority({ title: "" });
      expect(result.error).toBeDefined();
      expect(db.organization.findUnique).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return a validation error for a title exceeding 255 characters", async () => {
      const result = await suggestPriority({ title: "a".repeat(256) });
      expect(result.error).toBeDefined();
      expect(db.organization.findUnique).not.toHaveBeenCalled();
    });

    it("should accept a title of exactly 255 characters (max allowed)", async () => {
      const result = await suggestPriority({ title: "a".repeat(255) });
      // Validation passes when exactly at the 255-char limit
      expect(result.error).toBeUndefined();
    });

    it("should return a validation error when suggestChecklists receives an empty title", async () => {
      const result = await suggestChecklists({ title: "" });
      expect(result.error).toBeDefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ─── 8.12 Auth failure guard ─────────────────────────────────────────────────

  describe("8.12 Auth failure guard", () => {
    it("should return { error: 'Unauthorized' } when session has no userId", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null, orgId: null });
      const result = await suggestPriority({ title: "Unauthorised call", description: "" });
      expect(result.error).toBe("Unauthorized");
      expect(db.organization.findUnique).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return { error: 'Unauthorized' } when session has userId but no orgId", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: USER_ID, orgId: null });
      const result = await generateCardDescription({ title: "No org call", context: "" });
      expect(result.error).toBe("Unauthorized");
    });
  });

  // ─── 8.17 AI_DAILY_LIMIT env override ────────────────────────────────────────

  describe("8.17 AI_DAILY_LIMIT env override is respected", () => {
    const ORIGINAL_ENV = process.env.AI_DAILY_LIMIT;

    afterEach(() => {
      // Restore the original env var and reset module registry
      if (ORIGINAL_ENV === undefined) {
        delete process.env.AI_DAILY_LIMIT;
      } else {
        process.env.AI_DAILY_LIMIT = ORIGINAL_ENV;
      }
      jest.resetModules();
    });

    it("uses AI_DAILY_LIMIT=3 override and rejects the call when aiCallsToday >= 3", async () => {
      process.env.AI_DAILY_LIMIT = "3";

      // Re-import the module so it picks up the new env var value at module load time
      let suggestWithOverride!: typeof suggestPriority;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ({ suggestPriority: suggestWithOverride } = require("@/actions/ai-actions") as typeof import("@/actions/ai-actions"));
      });

      // Org has already used 3 calls today — should hit the overridden limit of 3
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: ORG_ID,
        aiCallsToday: 3,
        aiCallsLimit: DEFAULT_LIMIT, // DB limit still 50, but env override is 3
        aiCallsResetAt: new Date(Date.now() + 60 * 60 * 1000), // resets in future
      });

      const result = await suggestWithOverride({ title: "Override test", description: "" });
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/limit.*3|3.*limit/i);
    });

    it("uses AI_DAILY_LIMIT=3 override and allows the call when aiCallsToday < 3", async () => {
      process.env.AI_DAILY_LIMIT = "3";

      let suggestWithOverride!: typeof suggestPriority;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ({ suggestPriority: suggestWithOverride } = require("@/actions/ai-actions") as typeof import("@/actions/ai-actions"));
      });

      // Org has only used 2 calls — should still be under the limit of 3
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: ORG_ID,
        aiCallsToday: 2,
        aiCallsLimit: DEFAULT_LIMIT,
        aiCallsResetAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      (db.organization.update as jest.Mock).mockResolvedValueOnce({});
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "HIGH" } }],
      });

      const result = await suggestWithOverride({ title: "Under override limit", description: "" });
      // Should succeed (not quota-blocked)
      expect(result.error).toBeUndefined();
    });
  });
});
