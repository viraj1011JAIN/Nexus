/**
 * Section 3 — Rate Limiting Tests
 *
 * Tests the sliding-window in-memory rate limiter (lib/action-protection.ts).
 * Uses jest.useFakeTimers() to control Date.now() without real delays.
 *
 * Every test uses a unique userId (generated via a monotonic counter) to prevent
 * cross-test contamination from the module-level Map store that persists across
 * all tests in the file.
 *
 * For each of the 19 named action buckets + default, the suite covers:
 *
 *   TEST A — Happy path : the limit-th request (not limit+1) still succeeds.
 *   TEST B — Over limit : the (limit+1)th request is blocked with a correctly
 *                         formatted resetInMs and error string.
 *   TEST C — Window reset: after jest.advanceTimersByTime(60_001) all old
 *                         timestamps are outside the sliding window and the
 *                         counter resets.
 *   TEST D — User isolation: a different user for the same action is
 *                         completely unaffected.
 *   TEST E — First-request invariant: the very first call is always allowed.
 *
 * Additionally:
 *   • resetInMs arithmetic is verified with precise advance values.
 *   • The RATE_LIMITS export is checked against the documented table.
 *   • General edge cases (multiple actions per user, double window, etc.).
 */

import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

// ─── Unique user ID generator ────────────────────────────────────────────────
// A monotonic counter ensures that even parameterised tests running in the same
// process never share a user-action key in the module-level store Map.
let _seed = 0;
function uid(label = "u"): string {
  return `rl-${label}-${++_seed}`;
}

// ─── The full bucket table as rows for describe.each ────────────────────────
const ALL_BUCKETS = Object.entries(RATE_LIMITS) as [string, number][];

// ─── Expected documented limits (source of truth for table tests) ────────────
const EXPECTED_LIMITS: Record<string, number> = {
  "create-board":       10,
  "delete-board":       10,
  "create-list":        20,
  "delete-list":        20,
  "update-list-order":  30,
  "create-card":        60,
  "delete-card":        40,
  "update-card":       120,
  "update-card-order": 120,
  "update-priority":    60,
  "set-due-date":       60,
  "create-comment":     60,
  "update-comment":     60,
  "delete-comment":     40,
  "add-reaction":      120,
  "remove-reaction":   120,
  "create-label":       10,
  "assign-label":      120,
  "assign-user":       120,
  default:              30,
};

// ─────────────────────────────────────────────────────────────────────────────
describe("Section 3 — Rate Limiting (checkRateLimit)", () => {
  // Use fake timers for every test in this file so Date.now() is deterministic.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RATE_LIMITS table — verify every documented value is present and correct
  // ──────────────────────────────────────────────────────────────────────────
  describe("RATE_LIMITS export — table correctness", () => {
    it("should export exactly 20 action keys (19 named + default)", () => {
      expect(Object.keys(RATE_LIMITS)).toHaveLength(20);
    });

    it.each(Object.entries(EXPECTED_LIMITS))(
      "should set RATE_LIMITS['%s'] = %i",
      (action, expected) => {
        expect(RATE_LIMITS[action as keyof typeof RATE_LIMITS]).toBe(expected);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E — First-request invariant (every bucket, no prior state)
  // ──────────────────────────────────────────────────────────────────────────
  describe("TEST E — first request is always allowed for every action", () => {
    it.each(ALL_BUCKETS)(
      "action '%s' (limit=%i): first request succeeds with remaining=limit-1",
      (action, limit) => {
        const result = checkRateLimit(uid("E"), action, limit);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - 1);
        // resetInMs is the full window when not yet blocked
        expect(result.resetInMs).toBe(60_000);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A — Happy path: the limit-th request still succeeds
  // ──────────────────────────────────────────────────────────────────────────
  describe("TEST A — all requests up to and including the limit succeed", () => {
    it.each(ALL_BUCKETS)(
      "action '%s' (limit=%i): exactly limit requests are all allowed",
      (action, limit) => {
        const userId = uid("A");

        // Requests 1 … limit-1: verify each intermediate remaining count
        for (let i = 0; i < limit - 1; i++) {
          const r = checkRateLimit(userId, action, limit);
          expect(r.allowed).toBe(true);
          expect(r.remaining).toBe(limit - 1 - i);
        }

        // The limit-th request must still succeed with remaining = 0
        const atLimit = checkRateLimit(userId, action, limit);
        expect(atLimit.allowed).toBe(true);
        expect(atLimit.remaining).toBe(0);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B — Over limit: (limit + 1)th request is blocked
  // ──────────────────────────────────────────────────────────────────────────
  describe("TEST B — the (limit+1)th request is blocked with correct formatting", () => {
    it.each(ALL_BUCKETS)(
      "action '%s' (limit=%i): (limit+1)th request blocked; resetInMs in range; Xs is positive integer",
      (action, limit) => {
        const userId = uid("B");

        // Fill the bucket to exactly the limit
        for (let i = 0; i < limit; i++) {
          checkRateLimit(userId, action, limit);
        }

        // One over the limit
        const result = checkRateLimit(userId, action, limit);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);

        // resetInMs must be a positive value within the window
        expect(result.resetInMs).toBeGreaterThan(0);
        expect(result.resetInMs).toBeLessThanOrEqual(60_000);

        // X = Math.ceil(resetInMs / 1000) must be a positive integer ≤ 60
        const x = Math.ceil(result.resetInMs / 1000);
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(60);

        // The error string callers produce must match the documented pattern
        const errorMsg = `Too many requests. Try again in ${x}s.`;
        expect(errorMsg).toMatch(/^Too many requests\. Try again in \d+s\.$/);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C — Sliding window reset: counter expires after 60 000 ms
  // ──────────────────────────────────────────────────────────────────────────
  describe("TEST C — counter resets after the 60s window slides past", () => {
    it.each(ALL_BUCKETS)(
      "action '%s' (limit=%i): allowed again after jest.advanceTimersByTime(60_001)",
      (action, limit) => {
        const userId = uid("C");

        // Exhaust the bucket at fake T = 0
        for (let i = 0; i < limit; i++) {
          checkRateLimit(userId, action, limit);
        }

        // Confirm blocked at T = 0
        expect(checkRateLimit(userId, action, limit).allowed).toBe(false);

        // Advance past the 60-second sliding window.
        // Date.now() now returns 60 001 ms.
        // windowStart = 60 001 − 60 000 = 1 ms.
        // All existing timestamps were recorded at T = 0 (< 1), so they fall
        // outside the window and are filtered away — counter resets to 0.
        jest.advanceTimersByTime(60_001);

        const result = checkRateLimit(userId, action, limit);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - 1);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D — User isolation: one user's state does not affect another
  // ──────────────────────────────────────────────────────────────────────────
  describe("TEST D — rate limit buckets are isolated per user", () => {
    it.each(ALL_BUCKETS)(
      "action '%s' (limit=%i): userA exhausted does not block userB",
      (action, limit) => {
        const userA = uid("D-a");
        const userB = uid("D-b");

        // Exhaust userA's bucket
        for (let i = 0; i < limit; i++) {
          checkRateLimit(userA, action, limit);
        }
        expect(checkRateLimit(userA, action, limit).allowed).toBe(false);

        // userB has a completely separate bucket — must be allowed
        const userBResult = checkRateLimit(userB, action, limit);
        expect(userBResult.allowed).toBe(true);
        expect(userBResult.remaining).toBe(limit - 1);
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetInMs arithmetic — precise verification of the formula
  //   resetInMs = WINDOW_MS − (now − timestamps[0])
  // Uses "create-board" (limit=10) as a convenient low-limit bucket.
  // ──────────────────────────────────────────────────────────────────────────
  describe("resetInMs — precise arithmetic verification", () => {
    const BUCKET = "create-board";
    const LIMIT  = RATE_LIMITS[BUCKET]; // 10

    it("should return resetInMs = 60 000 when bucket has capacity remaining", () => {
      const result = checkRateLimit(uid("rms-ok"), BUCKET, LIMIT);
      expect(result.resetInMs).toBe(60_000);
    });

    it("should return resetInMs = 60 000 when blocked at T=0 (all timestamps at T=0)", () => {
      // With fake timers, Date.now() returns the same value for every synchronous
      // call — there is no drift between consecutive calls in one test.
      const userId = uid("rms-t0");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      // timestamps[0] = T=0, now = T=0 → resetInMs = 60 000 − (0 − 0) = 60 000
      const blocked = checkRateLimit(userId, BUCKET, LIMIT);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetInMs).toBe(60_000);
    });

    it("should return resetInMs = 30 000 after 30 000 ms have elapsed", () => {
      const userId = uid("rms-30s");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      jest.advanceTimersByTime(30_000); // T = 30 000

      // timestamps[0] = 0, now = 30 000 → resetInMs = 60 000 − 30 000 = 30 000
      const blocked = checkRateLimit(userId, BUCKET, LIMIT);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetInMs).toBe(30_000);
      expect(Math.ceil(blocked.resetInMs / 1000)).toBe(30); // "Try again in 30s."
    });

    it("should return resetInMs = 1 000 when 59 000 ms have elapsed", () => {
      const userId = uid("rms-1s");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      jest.advanceTimersByTime(59_000); // T = 59 000

      // resetInMs = 60 000 − 59 000 = 1 000
      const blocked = checkRateLimit(userId, BUCKET, LIMIT);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetInMs).toBe(1_000);
      expect(Math.ceil(blocked.resetInMs / 1000)).toBe(1); // "Try again in 1s."
    });

    it("should produce 'Try again in 60s.' when 1 ms has elapsed (ceil rounds 59.999 up)", () => {
      // After 1 ms: resetInMs = 60 000 − 1 = 59 999.
      // Math.ceil(59 999 / 1 000) = Math.ceil(59.999) = 60
      const userId = uid("rms-ceil");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      jest.advanceTimersByTime(1);

      const blocked = checkRateLimit(userId, BUCKET, LIMIT);
      expect(blocked.resetInMs).toBe(59_999);
      const x = Math.ceil(blocked.resetInMs / 1000);
      expect(x).toBe(60);
      expect(`Too many requests. Try again in ${x}s.`).toBe(
        "Too many requests. Try again in 60s."
      );
    });

    it("should produce 'Try again in 59s.' when exactly 1 000 ms have elapsed", () => {
      const userId = uid("rms-59s");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      jest.advanceTimersByTime(1_000); // resetInMs = 60 000 − 1 000 = 59 000

      const blocked = checkRateLimit(userId, BUCKET, LIMIT);
      expect(blocked.resetInMs).toBe(59_000);
      const x = Math.ceil(blocked.resetInMs / 1000);
      expect(x).toBe(59);
      expect(`Too many requests. Try again in ${x}s.`).toBe(
        "Too many requests. Try again in 59s."
      );
    });

    it("should produce strictly decreasing resetInMs values as time advances", () => {
      const userId = uid("rms-decreasing");
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, BUCKET, LIMIT);

      let prevResetInMs = Infinity;
      // Sample resetInMs at 0, 10 000, 20 000, … 50 000 ms
      for (let tick = 0; tick < 6; tick++) {
        if (tick > 0) jest.advanceTimersByTime(10_000);
        const r = checkRateLimit(userId, BUCKET, LIMIT);
        expect(r.allowed).toBe(false);
        expect(r.resetInMs).toBeLessThan(prevResetInMs);
        prevResetInMs = r.resetInMs;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RateLimitResult interface — shape contract
  // ──────────────────────────────────────────────────────────────────────────
  describe("RateLimitResult interface — return value shape", () => {
    it("should return { allowed: true, remaining: number, resetInMs: 60000 } when under limit", () => {
      const result = checkRateLimit(uid("shape-ok"), "create-card", 60);
      expect(result).toMatchObject({
        allowed:   true,
        remaining: expect.any(Number),
        resetInMs: 60_000,
      });
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("should return { allowed: false, remaining: 0, resetInMs: >0 } when blocked", () => {
      const userId = uid("shape-blocked");
      for (let i = 0; i < 10; i++) checkRateLimit(userId, "create-board", 10);

      const result = checkRateLimit(userId, "create-board", 10);
      expect(result).toMatchObject({
        allowed:   false,
        remaining: 0,
        resetInMs: expect.any(Number),
      });
      expect(result.resetInMs).toBeGreaterThan(0);
    });

    it("should return finite numbers for resetInMs (never NaN or Infinity)", () => {
      const r1 = checkRateLimit(uid("finite-ok"), "create-board", 10);
      expect(Number.isFinite(r1.resetInMs)).toBe(true);

      const userId = uid("finite-blocked");
      for (let i = 0; i < 10; i++) checkRateLimit(userId, "create-board", 10);
      const r2 = checkRateLimit(userId, "create-board", 10);
      expect(Number.isFinite(r2.resetInMs)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("should default to limit=30 when third argument is omitted", () => {
      const userId = uid("default-arg");
      for (let i = 0; i < 30; i++) {
        expect(checkRateLimit(userId, "some-unknown-action").allowed).toBe(true);
      }
      // 31st request must be blocked
      expect(checkRateLimit(userId, "some-unknown-action").allowed).toBe(false);
    });

    it("should treat different actions for the same user as independent buckets", () => {
      const userId = uid("multi-action");

      // Exhaust create-board (10) for this user
      for (let i = 0; i < 10; i++) checkRateLimit(userId, "create-board", 10);
      expect(checkRateLimit(userId, "create-board", 10).allowed).toBe(false);

      // create-card (60) for the same user is completely independent
      const r = checkRateLimit(userId, "create-card", 60);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(59);

      // delete-list (20) also completely independent
      expect(checkRateLimit(userId, "delete-list", 20).allowed).toBe(true);
    });

    it("should track remaining accurately across all requests up to the limit", () => {
      const userId = uid("remaining-counter");
      const LIMIT  = RATE_LIMITS["delete-comment"]; // 40

      for (let i = 0; i < LIMIT; i++) {
        const r = checkRateLimit(userId, "delete-comment", LIMIT);
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(LIMIT - (i + 1));
      }

      // Bucket is full — next request is blocked with remaining = 0
      const blocked = checkRateLimit(userId, "delete-comment", LIMIT);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("should survive two consecutive window expirations cleanly", () => {
      const userId = uid("double-window");
      const LIMIT  = RATE_LIMITS["create-board"]; // 10

      // ── Window 1 ──────────────────────────────────────────────
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userId, "create-board", LIMIT);
      expect(checkRateLimit(userId, "create-board", LIMIT).allowed).toBe(false);

      jest.advanceTimersByTime(60_001); // window 1 expires → T = 60 001 ms

      // First request in window 2 is allowed
      expect(checkRateLimit(userId, "create-board", LIMIT).allowed).toBe(true);

      // ── Window 2 (1 request already consumed above) ───────────
      for (let i = 0; i < LIMIT - 1; i++) checkRateLimit(userId, "create-board", LIMIT);
      expect(checkRateLimit(userId, "create-board", LIMIT).allowed).toBe(false);

      jest.advanceTimersByTime(60_001); // window 2 expires → T = 120 002 ms

      // First request in window 3 is allowed
      expect(checkRateLimit(userId, "create-board", LIMIT).allowed).toBe(true);
    });

    it("should not affect a blocked user's state when another user makes requests", () => {
      const userBlocked = uid("edge-blocked");
      const userFresh   = uid("edge-fresh");
      const LIMIT       = RATE_LIMITS["create-list"]; // 20

      // Exhaust and block userBlocked
      for (let i = 0; i < LIMIT; i++) checkRateLimit(userBlocked, "create-list", LIMIT);
      expect(checkRateLimit(userBlocked, "create-list", LIMIT).allowed).toBe(false);

      // userFresh makes 5 requests — must not touch userBlocked's bucket
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(userFresh, "create-list", LIMIT).allowed).toBe(true);
      }

      // userBlocked is still blocked (state unchanged)
      expect(checkRateLimit(userBlocked, "create-list", LIMIT).allowed).toBe(false);
    });

    it("should enforce a limit of exactly 1 when custom limit=1 is used", () => {
      const userId = uid("limit-1");
      expect(checkRateLimit(userId, "critical-action", 1).allowed).toBe(true);
      expect(checkRateLimit(userId, "critical-action", 1).allowed).toBe(false);

      jest.advanceTimersByTime(60_001);
      expect(checkRateLimit(userId, "critical-action", 1).allowed).toBe(true);
    });

    it("should allow all 120 requests for add-reaction before blocking the 121st", () => {
      const userId = uid("high-limit");
      const LIMIT  = RATE_LIMITS["add-reaction"]; // 120

      for (let i = 0; i < LIMIT; i++) {
        expect(checkRateLimit(userId, "add-reaction", LIMIT).allowed).toBe(true);
      }
      expect(checkRateLimit(userId, "add-reaction", LIMIT).allowed).toBe(false);
    });

    it("should keep update-card-order and update-card independent despite both being 120", () => {
      const userId = uid("dnd-vs-update");

      // Exhaust update-card-order
      for (let i = 0; i < 120; i++) checkRateLimit(userId, "update-card-order", 120);
      expect(checkRateLimit(userId, "update-card-order", 120).allowed).toBe(false);

      // update-card bucket for same user must be unaffected
      expect(checkRateLimit(userId, "update-card", 120).allowed).toBe(true);
    });

    it("should keep assign-label and assign-user independent despite both being 120", () => {
      const userId = uid("label-vs-user");

      for (let i = 0; i < 120; i++) checkRateLimit(userId, "assign-label", 120);
      expect(checkRateLimit(userId, "assign-label", 120).allowed).toBe(false);

      // assign-user bucket is a separate counter
      expect(checkRateLimit(userId, "assign-user", 120).allowed).toBe(true);
    });
  });
});
