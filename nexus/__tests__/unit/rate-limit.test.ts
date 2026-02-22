/**
 * checkRateLimit — sliding window rate limiter tests
 *
 * Uses Jest fake timers so we can advance the clock past the 60-second window
 * and verify that timestamps outside the window no longer count.
 * Each test uses a unique userId to avoid state interference from the
 * module-level store Map.
 */

import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

describe("checkRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows the first request and returns correct remaining count", () => {
    const limit = RATE_LIMITS["create-card"];
    const result = checkRateLimit("rt-user-1", "create-card", limit);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it("blocks requests once the per-window limit is reached", () => {
    const limit = RATE_LIMITS["create-board"]; // 10 per 60s
    for (let i = 0; i < limit; i++) {
      checkRateLimit("rt-user-2", "create-board", limit);
    }
    const result = checkRateLimit("rt-user-2", "create-board", limit);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetInMs).toBeGreaterThan(0);
  });

  it("allows requests again after the window expires", () => {
    const limit = RATE_LIMITS["create-board"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("rt-user-3", "create-board", limit);
    }

    // Blocked now
    expect(checkRateLimit("rt-user-3", "create-board", limit).allowed).toBe(false);

    // Advance past the 60-second sliding window
    jest.advanceTimersByTime(61_000);

    // All old timestamps are now outside the window — bucket resets
    const result = checkRateLimit("rt-user-3", "create-board", limit);
    expect(result.allowed).toBe(true);
  });

  it("isolates limits per user — one user exhausted does not affect another", () => {
    const limit = RATE_LIMITS["create-board"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("rt-user-4a", "create-board", limit);
    }

    // rt-user-4a is at limit
    expect(checkRateLimit("rt-user-4a", "create-board", limit).allowed).toBe(false);

    // rt-user-4b is completely independent
    expect(checkRateLimit("rt-user-4b", "create-board", limit).allowed).toBe(true);
  });
});
