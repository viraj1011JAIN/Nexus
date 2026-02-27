/**
 * Section 11C — STRIPE_CONFIG Limits & isStripeConfigured() Unit Tests
 *
 * Source: lib/stripe.ts
 *
 * Covers:
 *   11.35  STRIPE_CONFIG.limits.FREE.boards = 50
 *   11.36  STRIPE_CONFIG.limits.FREE.cardsPerBoard = 500
 *   11.37  STRIPE_CONFIG.limits.PRO.boards = Infinity
 *   11.38  STRIPE_CONFIG.limits.PRO.cardsPerBoard = Infinity
 *   11.39  PRO limits > FREE limits (numeric comparison — not string comparison)
 *   11.40  isStripeConfigured() returns false when STRIPE_SECRET_KEY is absent
 *   11.41  isStripeConfigured() returns false when STRIPE_PRO_MONTHLY_PRICE_ID is absent
 *   11.42  isStripeConfigured() returns false when STRIPE_PRO_YEARLY_PRICE_ID is absent
 *   11.43  isStripeConfigured() returns true when ALL three keys are present
 *   11.44  isStripeConfigured() returns false when any key value is empty string
 *   11.45  STRIPE_CONFIG.currency = "gbp"
 *   11.46  STRIPE_CONFIG.pricing.currency = "£"
 *   11.47  STRIPE_CONFIG.pricing.monthly = 9  (£9/month)
 *   11.48  STRIPE_CONFIG.pricing.yearly  = 90 (£90/year — 17% saving)
 */

// ─────────────────────────────────────────────────────────────────────────────
// We must mock the 'stripe' package BEFORE requiring lib/stripe.ts so that
// the Stripe constructor (which needs a global fetch) is never actually called.
// jest.resetModules() clears the module registry; the mock is re-applied
// automatically because Jest re-reads jest.mock() declarations on each require.
// ─────────────────────────────────────────────────────────────────────────────

// Mock Stripe SDK to prevent FetchHttpClient from requiring global fetch
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({}));
});

function loadStripeModule() {
  // Isolate module registry so env changes take effect
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/stripe") as typeof import("@/lib/stripe");
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const backup: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    backup[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try { fn(); }
  finally {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 11C — STRIPE_CONFIG limits & isStripeConfigured()", () => {
  // ─── 11.35 FREE board limit ─────────────────────────────────────────────────

  describe("11.35 STRIPE_CONFIG.limits.FREE.boards = 50", () => {
    it("FREE plan board limit is exactly 50", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.limits.FREE.boards).toBe(50);
    });
  });

  // ─── 11.36 FREE card limit ──────────────────────────────────────────────────

  describe("11.36 STRIPE_CONFIG.limits.FREE.cardsPerBoard = 500", () => {
    it("FREE plan card-per-board limit is exactly 500", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.limits.FREE.cardsPerBoard).toBe(500);
    });
  });

  // ─── 11.37 PRO board limit = Infinity ────────────────────────────────────────

  describe("11.37 STRIPE_CONFIG.limits.PRO.boards = Infinity", () => {
    it("PRO plan has unlimited boards (Infinity)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.limits.PRO.boards).toBe(Infinity);
    });

    it("PRO board limit is not a finite number", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(Number.isFinite(STRIPE_CONFIG.limits.PRO.boards)).toBe(false);
    });
  });

  // ─── 11.38 PRO card limit = Infinity ─────────────────────────────────────────

  describe("11.38 STRIPE_CONFIG.limits.PRO.cardsPerBoard = Infinity", () => {
    it("PRO plan has unlimited cards per board (Infinity)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.limits.PRO.cardsPerBoard).toBe(Infinity);
    });
  });

  // ─── 11.39 PRO > FREE (numeric comparison) ────────────────────────────────────

  describe("11.39 PRO limits are greater than FREE limits — numeric comparison", () => {
    it("PRO board limit is numerically greater than FREE (not a string comparison)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      // This assertion would fail if limits were stored as strings
      expect(STRIPE_CONFIG.limits.PRO.boards).toBeGreaterThan(STRIPE_CONFIG.limits.FREE.boards);
    });

    it("PRO cardsPerBoard limit is numerically greater than FREE", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.limits.PRO.cardsPerBoard).toBeGreaterThan(STRIPE_CONFIG.limits.FREE.cardsPerBoard);
    });

    it("any free-plan board count up to limit passes (49 < FREE.boards)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(49).toBeLessThan(STRIPE_CONFIG.limits.FREE.boards);
    });

    it("free-plan limit enforcement: 51 > FREE.boards (51st board blocked)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(51).toBeGreaterThan(STRIPE_CONFIG.limits.FREE.boards);
    });
  });

  // ─── 11.40 isStripeConfigured — STRIPE_SECRET_KEY absent ─────────────────────

  describe("11.40 isStripeConfigured() returns false when STRIPE_SECRET_KEY is absent", () => {
    it("returns false when STRIPE_SECRET_KEY is undefined", () => {
      withEnv({ STRIPE_SECRET_KEY: undefined }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(false);
      });
    });
  });

  // ─── 11.41 isStripeConfigured — STRIPE_PRO_MONTHLY_PRICE_ID absent ───────────

  describe("11.41 isStripeConfigured() returns false when STRIPE_PRO_MONTHLY_PRICE_ID is absent", () => {
    it("returns false when monthly price ID is missing", () => {
      withEnv({
        STRIPE_SECRET_KEY:             "sk_test_dummy",
        STRIPE_PRO_MONTHLY_PRICE_ID:   undefined,
        STRIPE_PRO_YEARLY_PRICE_ID:    "price_yearly",
      }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(false);
      });
    });
  });

  // ─── 11.42 isStripeConfigured — STRIPE_PRO_YEARLY_PRICE_ID absent ────────────

  describe("11.42 isStripeConfigured() returns false when STRIPE_PRO_YEARLY_PRICE_ID is absent", () => {
    it("returns false when yearly price ID is missing", () => {
      withEnv({
        STRIPE_SECRET_KEY:             "sk_test_dummy",
        STRIPE_PRO_MONTHLY_PRICE_ID:   "price_monthly",
        STRIPE_PRO_YEARLY_PRICE_ID:    undefined,
      }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(false);
      });
    });
  });

  // ─── 11.43 isStripeConfigured — all keys present → true ──────────────────────

  describe("11.43 isStripeConfigured() returns true when ALL three keys are present", () => {
    it("returns true when all required Stripe env vars are set", () => {
      withEnv({
        STRIPE_SECRET_KEY:             "sk_test_abc123",
        STRIPE_PRO_MONTHLY_PRICE_ID:   "price_monthly_001",
        STRIPE_PRO_YEARLY_PRICE_ID:    "price_yearly_001",
      }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(true);
      });
    });
  });

  // ─── 11.44 isStripeConfigured — empty string counts as unconfigured ───────────

  describe("11.44 isStripeConfigured() returns false when any key is empty string", () => {
    it("returns false when STRIPE_SECRET_KEY is empty string", () => {
      withEnv({
        STRIPE_SECRET_KEY:             "",
        STRIPE_PRO_MONTHLY_PRICE_ID:   "price_monthly",
        STRIPE_PRO_YEARLY_PRICE_ID:    "price_yearly",
      }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(false);
      });
    });

    it("returns false when STRIPE_PRO_MONTHLY_PRICE_ID is empty string", () => {
      withEnv({
        STRIPE_SECRET_KEY:             "sk_test_dummy",
        STRIPE_PRO_MONTHLY_PRICE_ID:   "",
        STRIPE_PRO_YEARLY_PRICE_ID:    "price_yearly",
      }, () => {
        const { isStripeConfigured } = loadStripeModule();
        expect(isStripeConfigured()).toBe(false);
      });
    });
  });

  // ─── 11.45 currency = "gbp" ──────────────────────────────────────────────────

  describe("11.45 STRIPE_CONFIG.currency = 'gbp'", () => {
    it("currency is GBP (not USD or EUR)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.currency).toBe("gbp");
    });
  });

  // ─── 11.46 pricing.currency = "£" ────────────────────────────────────────────

  describe("11.46 STRIPE_CONFIG.pricing.currency = '£'", () => {
    it("pricing symbol is the pound sign", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.pricing.currency).toBe("£");
    });
  });

  // ─── 11.47 pricing.monthly = 9 ───────────────────────────────────────────────

  describe("11.47 STRIPE_CONFIG.pricing.monthly = 9", () => {
    it("monthly price is £9", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.pricing.monthly).toBe(9);
    });
  });

  // ─── 11.48 pricing.yearly = 90 ───────────────────────────────────────────────

  describe("11.48 STRIPE_CONFIG.pricing.yearly = 90", () => {
    it("yearly price is £90 (12 × £9 × 83% ≈ £90)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.pricing.yearly).toBe(90);
    });

    it("yearly price is less than monthly × 12 (discount applies)", () => {
      const { STRIPE_CONFIG } = loadStripeModule();
      expect(STRIPE_CONFIG.pricing.yearly).toBeLessThan(STRIPE_CONFIG.pricing.monthly * 12);
    });
  });
});
