/**
 * @jest-environment node
 */

/**
 * Section 11A — Stripe Checkout & Portal Route Handlers
 *
 * Tests:  POST /api/stripe/checkout   (app/api/stripe/checkout/route.ts)
 *         POST /api/stripe/portal     (app/api/stripe/portal/route.ts)
 *
 * Covers:
 *   11.1  Checkout — 503 when Stripe is not configured (missing env keys)
 *   11.2  Checkout — 401 when no orgId in Clerk session
 *   11.3  Checkout — 400 when priceId is missing from request body
 *   11.4  Checkout — 404 when Clerk orgId has no DB row
 *   11.5  Checkout — creates new Stripe customer when org has no stripeCustomerId
 *   11.6  Checkout — reuses existing stripeCustomerId (no duplicate customer.create call)
 *   11.7  Checkout — creates Checkout Session with correct priceId and returns { url }
 *   11.8  Checkout — sets currency=GBP and mode=subscription on the session
 *   11.9  Checkout — saves new stripeCustomerId to DB after creation
 *   11.10 Checkout — 500 when stripe.checkout.sessions.create throws unexpectedly
 *   11.11 Portal   — 401 when no orgId
 *   11.12 Portal   — 404 when org not found in DB
 *   11.13 Portal   — 400 when org has no stripeCustomerId
 *   11.14 Portal   — returns { url } from Stripe billing portal
 *   11.15 Portal   — 500 on unexpected Stripe error
 */

import { NextRequest } from "next/server";
import { POST as checkoutPOST } from "@/app/api/stripe/checkout/route";
import { POST as portalPOST }   from "@/app/api/stripe/portal/route";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID      = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_ID = "cus_test_aaaaaaaaaaaa";
const PRICE_ID    = "price_monthly_test_001";
const SESSION_URL = "https://checkout.stripe.com/pay/cs_test_abc";
const PORTAL_URL  = "https://billing.stripe.com/session/bps_test";

const ORG_NO_CUSTOMER = {
  id:               ORG_ID,
  name:             "Test Org",
  stripeCustomerId: null,
  subscriptionPlan: "FREE",
};

const ORG_WITH_CUSTOMER = {
  ...ORG_NO_CUSTOMER,
  stripeCustomerId: CUSTOMER_ID,
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
}));

jest.mock("@/lib/stripe", () => ({
  isStripeConfigured: jest.fn().mockReturnValue(true),
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({ id: "cus_test_aaaaaaaaaaaa" }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test_abc" }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: "https://billing.stripe.com/session/bps_test" }),
      },
    },
  },
}));

jest.mock("@/lib/db", () => ({
  db: {
    organization: {
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCheckoutReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/stripe/checkout", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makePortalReq(): NextRequest {
  return new NextRequest("http://localhost/api/stripe/portal", { method: "POST" });
}

function resetMocks() {
  const { auth }              = jest.requireMock("@clerk/nextjs/server")      as { auth: jest.Mock };
  const { isStripeConfigured, stripe } = jest.requireMock("@/lib/stripe")    as { isStripeConfigured: jest.Mock; stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } }; billingPortal: { sessions: { create: jest.Mock } } } };
  const { db }                = jest.requireMock("@/lib/db")                  as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };

  auth.mockResolvedValue({ orgId: ORG_ID });
  isStripeConfigured.mockReturnValue(true);
  (stripe.customers.create as jest.Mock).mockResolvedValue({ id: CUSTOMER_ID });
  (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: SESSION_URL });
  (stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({ url: PORTAL_URL });
  db.organization.findUnique.mockResolvedValue(ORG_NO_CUSTOMER);
  db.organization.update.mockResolvedValue({});
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 11A — Stripe Checkout & Portal Route Handlers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetMocks();
  });

  // ─── 11.1 Checkout — Stripe not configured → 503 ─────────────────────────

  describe("11.1 POST /api/stripe/checkout — Stripe not configured → 503", () => {
    it("returns HTTP 503 when isStripeConfigured() returns false", async () => {
      const { isStripeConfigured } = jest.requireMock("@/lib/stripe") as { isStripeConfigured: jest.Mock };
      isStripeConfigured.mockReturnValueOnce(false);

      const res = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(res.status).toBe(503);
    });

    it("returns an error body explaining the configuration issue", async () => {
      const { isStripeConfigured } = jest.requireMock("@/lib/stripe") as { isStripeConfigured: jest.Mock };
      isStripeConfigured.mockReturnValueOnce(false);

      const body = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID })).then(r => r.json()) as { error: string };
      expect(body.error).toMatch(/STRIPE_SECRET_KEY|not configured/i);
    });

    it("does not call auth() when Stripe is not configured (fast-exit)", async () => {
      const { isStripeConfigured } = jest.requireMock("@/lib/stripe") as { isStripeConfigured: jest.Mock };
      isStripeConfigured.mockReturnValueOnce(false);
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(auth).not.toHaveBeenCalled();
    });
  });

  // ─── 11.2 Checkout — unauthorized → 401 ──────────────────────────────────

  describe("11.2 POST /api/stripe/checkout — unauthorized → 401", () => {
    it("returns 401 when Clerk returns no orgId", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ orgId: null });

      const res = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(res.status).toBe(401);
    });

    it("body contains { error: 'Unauthorized' }", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ orgId: null });

      const body = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID })).then(r => r.json()) as { error: string };
      expect(body.error).toBe("Unauthorized");
    });
  });

  // ─── 11.3 Checkout — missing priceId → 400 ───────────────────────────────

  describe("11.3 POST /api/stripe/checkout — missing priceId → 400", () => {
    it("returns 400 when priceId is absent from request body", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      const res = await checkoutPOST(makeCheckoutReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 when priceId is empty string", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      const res = await checkoutPOST(makeCheckoutReq({ priceId: "" }));
      expect(res.status).toBe(400);
    });
  });

  // ─── 11.4 Checkout — org not found → 404 ─────────────────────────────────

  describe("11.4 POST /api/stripe/checkout — org not found → 404", () => {
    it("returns 404 when org does not exist in DB", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(null);

      const res = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(res.status).toBe(404);
    });
  });

  // ─── 11.5 Checkout — creates new Stripe customer when none exists ─────────

  describe("11.5 POST /api/stripe/checkout — creates new Stripe customer when org has none", () => {
    it("calls stripe.customers.create when stripeCustomerId is null", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    });

    it("saves the new Stripe customerId to the DB", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);
      stripe.customers.create.mockResolvedValueOnce({ id: CUSTOMER_ID });

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(db.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ stripeCustomerId: CUSTOMER_ID }),
        }),
      );
    });

    it("passes orgId and orgName as metadata to Stripe customer", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ orgId: ORG_ID }) }),
      );
    });
  });

  // ─── 11.6 Checkout — reuses existing customer (no duplicate create) ─────────

  describe("11.6 POST /api/stripe/checkout — reuses existing stripeCustomerId", () => {
    it("does NOT call stripe.customers.create when org already has a customer ID", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("passes the existing customer ID directly to checkout session", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: CUSTOMER_ID }),
      );
    });
  });

  // ─── 11.7 Checkout — creates session, returns { url } → 200 ────────────────

  describe("11.7 POST /api/stripe/checkout — happy path returns Checkout URL", () => {
    it("returns HTTP 200 with a Checkout session URL", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      const res = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(res.status).toBe(200);
      const body = await res.json() as { url: string };
      expect(body.url).toBe(SESSION_URL);
    });

    it("forwards the priceId to the checkout session line_items", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: expect.arrayContaining([
            expect.objectContaining({ price: PRICE_ID, quantity: 1 }),
          ]),
        }),
      );
    });
  });

  // ─── 11.8 Checkout — GBP currency and subscription mode ────────────────────

  describe("11.8 POST /api/stripe/checkout — GBP currency and subscription mode", () => {
    it("creates checkout session with currency=gbp", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "gbp" }),
      );
    });

    it("creates checkout session with mode=subscription", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "subscription" }),
      );
    });

    it("includes orgId in session metadata", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ orgId: ORG_ID }) }),
      );
    });
  });

  // ─── 11.9 Checkout — saves customerId after creation ───────────────────────

  describe("11.9 POST /api/stripe/checkout — customerId persisted correctly", () => {
    it("does not call db.update to save customerId when org already had one", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));

      // update() is NOT called for saving the customer ID (it was already set)
      expect(db.organization.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stripeCustomerId: expect.any(String) }) }),
      );
    });
  });

  // ─── 11.10 Checkout — unexpected Stripe error → 500 ─────────────────────────

  describe("11.10 POST /api/stripe/checkout — unexpected Stripe error → 500", () => {
    it("returns 500 when stripe.checkout.sessions.create throws", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);
      stripe.checkout.sessions.create.mockRejectedValueOnce(new Error("Stripe network failure"));

      const res = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID }));
      expect(res.status).toBe(500);
    });

    it("does not expose internal Stripe error message in the 500 response", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { customers: { create: jest.Mock }; checkout: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);
      stripe.checkout.sessions.create.mockRejectedValueOnce(new Error("Stripe secret exposed message"));

      const body = await checkoutPOST(makeCheckoutReq({ priceId: PRICE_ID })).then(r => r.json()) as { error: string };
      expect(body.error).not.toContain("Stripe secret exposed message");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Portal Route Tests
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── 11.11 Portal — unauthorized → 401 ───────────────────────────────────────

  describe("11.11 POST /api/stripe/portal — unauthorized → 401", () => {
    it("returns 401 when no orgId in session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ orgId: null });

      const res = await portalPOST();
      expect(res.status).toBe(401);
    });
  });

  // ─── 11.12 Portal — org not found → 404 ─────────────────────────────────────

  describe("11.12 POST /api/stripe/portal — org not found → 404", () => {
    it("returns 404 when org row is missing", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(null);

      const res = await portalPOST();
      expect(res.status).toBe(404);
    });
  });

  // ─── 11.13 Portal — no stripeCustomerId → 400 ─────────────────────────────────

  describe("11.13 POST /api/stripe/portal — no stripeCustomerId → 400", () => {
    it("returns 400 when org has no billing information", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      const res = await portalPOST();
      expect(res.status).toBe(400);
    });

    it("body contains a descriptive error about missing billing info", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_NO_CUSTOMER);

      const body = await portalPOST().then(r => r.json()) as { error: string };
      expect(body.error).toMatch(/billing|No billing information/i);
    });
  });

  // ─── 11.14 Portal — happy path returns { url } ────────────────────────────────

  describe("11.14 POST /api/stripe/portal — returns Stripe portal URL", () => {
    it("returns HTTP 200 with portal URL", async () => {
      const { db } = jest.requireMock("@/lib/db") as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      const res = await portalPOST();
      expect(res.status).toBe(200);
      const body = await res.json() as { url: string };
      expect(body.url).toBe(PORTAL_URL);
    });

    it("calls billingPortal.sessions.create with the org's customer ID", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { billingPortal: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);

      await portalPOST();
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: CUSTOMER_ID }),
      );
    });
  });

  // ─── 11.15 Portal — unexpected error → 500 ────────────────────────────────────

  describe("11.15 POST /api/stripe/portal — unexpected error → 500", () => {
    it("returns 500 when billingPortal.sessions.create throws", async () => {
      const { db }     = jest.requireMock("@/lib/db")     as { db: { organization: { findUnique: jest.Mock; update: jest.Mock } } };
      const { stripe } = jest.requireMock("@/lib/stripe") as { stripe: { billingPortal: { sessions: { create: jest.Mock } } } };

      db.organization.findUnique.mockResolvedValueOnce(ORG_WITH_CUSTOMER);
      stripe.billingPortal.sessions.create.mockRejectedValueOnce(new Error("Portal creation failed"));

      const res = await portalPOST();
      expect(res.status).toBe(500);
    });
  });
});
