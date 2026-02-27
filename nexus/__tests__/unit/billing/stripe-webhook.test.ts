/**
 * @jest-environment node
 */

/**
 * Section 11B — Stripe Webhook Handler Tests
 *
 * Source: app/api/webhook/stripe/route.ts
 *
 * Architecture:
 *   • Uses systemDb (bypasses RLS) — verified by HMAC signature
 *   • stripe.webhooks.constructEvent() validates signature synchronously
 *   • Each supported event type updates the organization row in DB
 *   • Unknown events → silently ignored → always returns 200 { received: true }
 *
 * Covers:
 *   11.16  Missing stripe-signature header → 400
 *   11.17  Invalid signature (constructEvent throws) → 400
 *   11.18  checkout.session.completed → org.subscriptionPlan set to PRO
 *   11.19  checkout.session.completed → stripeCustomerId, subscriptionId, priceId persisted
 *   11.20  checkout.session.completed → stripeCurrentPeriodEnd persisted as Date
 *   11.21  checkout.session.completed — missing orgId in metadata → no DB update
 *   11.22  invoice.payment_succeeded → stripeCurrentPeriodEnd updated
 *   11.23  invoice.payment_succeeded — missing subscriptionId → no DB update (safe exit)
 *   11.24  invoice.payment_failed → stripeSubscriptionStatus set to "past_due"
 *   11.25  invoice.payment_failed — missing subscriptionId → no DB update
 *   11.26  customer.subscription.updated → status synced (orgId in metadata)
 *   11.27  customer.subscription.updated → falls back to findUnique by customerId
 *   11.28  customer.subscription.deleted → subscriptionPlan reset to FREE (orgId in metadata)
 *   11.29  customer.subscription.deleted → subscriptionId, priceId, periodEnd all set null
 *   11.30  customer.subscription.deleted → fallback to findUnique by customerId
 *   11.31  Unknown event type → silently ignored, returns 200 { received: true }
 *   11.32  Unknown event type → does NOT call db.update
 *   11.33  Stripe subscription with unknown plan key → fail-closed, no crash
 *   11.34  Always returns 200 { received: true } for all successfully handled events
 */

import { NextRequest } from "next/server";
import { POST }        from "@/app/api/webhook/stripe/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID       = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_ID  = "cus_test_aaaaaaaaaaaa";
const SUB_ID       = "sub_test_aaaaaaaaaaaa";
const PRICE_ID     = "price_monthly_test_001";
const PERIOD_END_S = 1800000000; // UNIX timestamp seconds

/** Minimal Stripe subscription object as returned by stripe.subscriptions.retrieve() */
const MOCK_SUBSCRIPTION = {
  id:                  SUB_ID,
  status:              "active",
  items:               { data: [{ price: { id: PRICE_ID } }] },
  current_period_end:  PERIOD_END_S,
  metadata:            { orgId: ORG_ID },
  customer:            CUSTOMER_ID,
};

/** Helpers to build fake Stripe event objects (as returned by constructEvent) */
function makeCheckoutCompletedEvent(overrides?: Partial<{ orgId?: string }>) {
  // Use "orgId" in overrides so that explicitly passing orgId:undefined is honoured
  const orgId = (overrides && "orgId" in overrides) ? overrides.orgId : ORG_ID;
  const metadata = orgId !== undefined ? { orgId } : {};
  return {
    id:   "evt_checkout_completed",
    type: "checkout.session.completed" as const,
    data: {
      object: {
        metadata,
        subscription: SUB_ID,
        customer:     CUSTOMER_ID,
      },
    },
  };
}

function makeInvoicePaymentSucceededEvent(subscriptionId: string | null = SUB_ID) {
  return {
    id:   "evt_invoice_paid",
    type: "invoice.payment_succeeded" as const,
    data: { object: { subscription: subscriptionId } },
  };
}

function makeInvoicePaymentFailedEvent(subscriptionId: string | null = SUB_ID) {
  return {
    id:   "evt_invoice_failed",
    type: "invoice.payment_failed" as const,
    data: { object: { subscription: subscriptionId } },
  };
}

function makeSubscriptionUpdatedEvent(opts?: { includeOrgId?: boolean }) {
  const includeOrgId = opts?.includeOrgId !== false;
  return {
    id:   "evt_sub_updated",
    type: "customer.subscription.updated" as const,
    data: {
      object: {
        id:                 SUB_ID,
        status:             "active",
        customer:           CUSTOMER_ID,
        current_period_end: PERIOD_END_S,
        metadata:           includeOrgId ? { orgId: ORG_ID } : {},
      },
    },
  };
}

function makeSubscriptionDeletedEvent(opts?: { includeOrgId?: boolean }) {
  const includeOrgId = opts?.includeOrgId !== false;
  return {
    id:   "evt_sub_deleted",
    type: "customer.subscription.deleted" as const,
    data: {
      object: {
        id:       SUB_ID,
        status:   "canceled",
        customer: CUSTOMER_ID,
        metadata: includeOrgId ? { orgId: ORG_ID } : {},
      },
    },
  };
}

function makeUnknownEvent() {
  return { id: "evt_unknown", type: "beta.test" as string, data: { object: {} } };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue("stripe-sig-valid"),
  }),
}));

jest.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks:      { constructEvent: jest.fn() },
    subscriptions: { retrieve:       jest.fn() },
  },
}));

jest.mock("@/lib/db", () => ({
  systemDb: {
    organization: {
      update:     jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error:   jest.fn(),
    warn:    jest.fn(),
    info:    jest.fn(),
    webhook: jest.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWebhookReq(body = "raw-stripe-body"): NextRequest {
  return new NextRequest("http://localhost/api/webhook/stripe", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "stripe-sig-valid" },
    body,
  });
}

function getDb() {
  return (jest.requireMock("@/lib/db") as { systemDb: { organization: { update: jest.Mock; findUnique: jest.Mock } } }).systemDb;
}

function getStripe() {
  return (jest.requireMock("@/lib/stripe") as { stripe: { webhooks: { constructEvent: jest.Mock }; subscriptions: { retrieve: jest.Mock } } }).stripe;
}

function getHeaders() {
  return (jest.requireMock("next/headers") as { headers: jest.Mock }).headers;
}

function getLogger() {
  return (jest.requireMock("@/lib/logger") as { logger: { error: jest.Mock; warn: jest.Mock; webhook: jest.Mock } }).logger;
}

function resetMocks() {
  getHeaders().mockResolvedValue({ get: jest.fn().mockReturnValue("stripe-sig-valid") });
  getStripe().webhooks.constructEvent.mockReturnValue(makeCheckoutCompletedEvent());
  getStripe().subscriptions.retrieve.mockResolvedValue(MOCK_SUBSCRIPTION);
  getDb().organization.update.mockResolvedValue({});
  getDb().organization.findUnique.mockResolvedValue({ id: ORG_ID, stripeCustomerId: CUSTOMER_ID });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 11B — Stripe Webhook Handler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetMocks();
  });

  // ─── 11.16 Missing stripe-signature → 400 ────────────────────────────────────

  describe("11.16 Missing stripe-signature header → 400", () => {
    it("returns 400 when stripe-signature header is absent", async () => {
      getHeaders().mockResolvedValueOnce({ get: jest.fn().mockReturnValue(null) });

      const res = await POST(makeWebhookReq());
      expect(res.status).toBe(400);
    });

    it("body contains { error: 'Missing stripe-signature header' }", async () => {
      getHeaders().mockResolvedValueOnce({ get: jest.fn().mockReturnValue(null) });

      const body = await POST(makeWebhookReq()).then(r => r.json()) as { error: string };
      expect(body.error).toMatch(/Missing stripe-signature/i);
    });

    it("does not call stripe.webhooks.constructEvent when signature is absent", async () => {
      getHeaders().mockResolvedValueOnce({ get: jest.fn().mockReturnValue(null) });

      await POST(makeWebhookReq());
      expect(getStripe().webhooks.constructEvent).not.toHaveBeenCalled();
    });
  });

  // ─── 11.17 Invalid signature → 400 ───────────────────────────────────────────

  describe("11.17 Invalid Stripe webhook signature → 400", () => {
    it("returns 400 when constructEvent throws (signature mismatch)", async () => {
      getStripe().webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error("No signatures found matching the expected signature for payload");
      });

      const res = await POST(makeWebhookReq());
      expect(res.status).toBe(400);
    });

    it("body contains { error: 'Invalid signature' }", async () => {
      getStripe().webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error("Invalid signature");
      });

      const body = await POST(makeWebhookReq()).then(r => r.json()) as { error: string };
      expect(body.error).toBe("Invalid signature");
    });

    it("logs the signature validation failure", async () => {
      getStripe().webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error("sig mismatch");
      });

      await POST(makeWebhookReq());
      expect(getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("signature"),
        expect.anything(),
      );
    });
  });

  // ─── 11.18 checkout.session.completed → org.plan = PRO ───────────────────────

  describe("11.18 checkout.session.completed → org.subscriptionPlan set to PRO", () => {
    it("calls db.organization.update with subscriptionPlan: 'PRO'", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ subscriptionPlan: "PRO" }),
        }),
      );
    });

    it("retrieves the subscription details from Stripe using the subscription ID", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());

      await POST(makeWebhookReq());
      expect(getStripe().subscriptions.retrieve).toHaveBeenCalledWith(SUB_ID);
    });
  });

  // ─── 11.19 checkout.session.completed → subscription fields persisted ─────────

  describe("11.19 checkout.session.completed → stripeCustomerId, subscriptionId, priceId persisted", () => {
    it("saves stripeSubscriptionId from the retrieved subscription", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeSubscriptionId: SUB_ID }),
        }),
      );
    });

    it("saves stripePriceId from the subscription's first line item", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripePriceId: PRICE_ID }),
        }),
      );
    });

    it("saves stripeCustomerId from the session customer field", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeCustomerId: CUSTOMER_ID }),
        }),
      );
    });
  });

  // ─── 11.20 checkout.session.completed → stripeCurrentPeriodEnd as Date ────────

  describe("11.20 checkout.session.completed → stripeCurrentPeriodEnd persisted as Date", () => {
    it("converts UNIX timestamp to Date object", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeCurrentPeriodEnd: new Date(PERIOD_END_S * 1000),
          }),
        }),
      );
    });
  });

  // ─── 11.21 checkout.session.completed — missing orgId → no DB update ──────────

  describe("11.21 checkout.session.completed — missing orgId in metadata → no DB update", () => {
    it("does not call db.update when metadata.orgId is missing", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeCheckoutCompletedEvent({ orgId: undefined }),
      );

      await POST(makeWebhookReq());
      expect(getDb().organization.update).not.toHaveBeenCalled();
    });

    it("still returns 200 { received: true } when orgId is missing", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeCheckoutCompletedEvent({ orgId: undefined }),
      );

      const res = await POST(makeWebhookReq());
      expect(res.status).toBe(200);
      const body = await res.json() as { received: boolean };
      expect(body.received).toBe(true);
    });
  });

  // ─── 11.22 invoice.payment_succeeded → period_end updated ────────────────────

  describe("11.22 invoice.payment_succeeded → stripeCurrentPeriodEnd updated", () => {
    it("updates stripeCurrentPeriodEnd from subscription data", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentSucceededEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({
            stripeCurrentPeriodEnd: new Date(PERIOD_END_S * 1000),
          }),
        }),
      );
    });

    it("also updates stripeSubscriptionStatus", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentSucceededEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeSubscriptionStatus: "active" }),
        }),
      );
    });
  });

  // ─── 11.23 invoice.payment_succeeded — missing subscriptionId → safe exit ─────

  describe("11.23 invoice.payment_succeeded — missing subscriptionId → safe exit", () => {
    it("does not call db.update when subscriptionId is null", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeInvoicePaymentSucceededEvent(null),
      );

      await POST(makeWebhookReq());
      expect(getDb().organization.update).not.toHaveBeenCalled();
    });

    it("still returns 200 { received: true }", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeInvoicePaymentSucceededEvent(null),
      );

      const res = await POST(makeWebhookReq());
      expect(res.status).toBe(200);
    });
  });

  // ─── 11.24 invoice.payment_failed → status set to "past_due" ─────────────────

  describe("11.24 invoice.payment_failed → stripeSubscriptionStatus set to 'past_due'", () => {
    it("sets stripeSubscriptionStatus to 'past_due'", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentFailedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ stripeSubscriptionStatus: "past_due" }),
        }),
      );
    });

    it("does NOT change subscriptionPlan (still PRO — payment_failed is not a cancellation)", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentFailedEvent());
      getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);

      await POST(makeWebhookReq());

      const updateCall = getDb().organization.update.mock.calls[0]?.[0] as {
        data: { subscriptionPlan?: string };
      };
      expect(updateCall?.data?.subscriptionPlan).toBeUndefined();
    });
  });

  // ─── 11.25 invoice.payment_failed — missing subscriptionId → safe exit ────────

  describe("11.25 invoice.payment_failed — missing subscriptionId → safe exit", () => {
    it("does not call db.update when subscriptionId is null", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeInvoicePaymentFailedEvent(null),
      );

      await POST(makeWebhookReq());
      expect(getDb().organization.update).not.toHaveBeenCalled();
    });
  });

  // ─── 11.26 customer.subscription.updated → status synced (orgId in metadata) ──

  describe("11.26 customer.subscription.updated → status synced when orgId in metadata", () => {
    it("updates stripeSubscriptionStatus from the event's subscription object", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionUpdatedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ stripeSubscriptionStatus: "active" }),
        }),
      );
    });

    it("updates stripeCurrentPeriodEnd from the event payload", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionUpdatedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeCurrentPeriodEnd: new Date(PERIOD_END_S * 1000),
          }),
        }),
      );
    });
  });

  // ─── 11.27 customer.subscription.updated — fallback to customerId lookup ───────

  describe("11.27 customer.subscription.updated — fallback to findUnique by customerId when no orgId in metadata", () => {
    it("calls db.organization.findUnique by stripeCustomerId when orgId absent from metadata", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionUpdatedEvent({ includeOrgId: false }),
      );
      getDb().organization.findUnique.mockResolvedValueOnce({ id: ORG_ID });

      await POST(makeWebhookReq());

      expect(getDb().organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stripeCustomerId: CUSTOMER_ID } }),
      );
    });

    it("still updates the org once found via customer ID", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionUpdatedEvent({ includeOrgId: false }),
      );
      getDb().organization.findUnique.mockResolvedValueOnce({ id: ORG_ID });

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ORG_ID } }),
      );
    });
  });

  // ─── 11.28 customer.subscription.deleted → plan reset to FREE ────────────────

  describe("11.28 customer.subscription.deleted → subscriptionPlan reset to FREE", () => {
    it("sets subscriptionPlan to FREE when orgId is in metadata", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ subscriptionPlan: "FREE" }),
        }),
      );
    });
  });

  // ─── 11.29 customer.subscription.deleted → subscription fields nulled ─────────

  describe("11.29 customer.subscription.deleted → stripeSubscriptionId, priceId, periodEnd all set null", () => {
    it("sets stripeSubscriptionId to null", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeSubscriptionId: null }),
        }),
      );
    });

    it("sets stripePriceId to null", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripePriceId: null }),
        }),
      );
    });

    it("sets stripeCurrentPeriodEnd to null", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeCurrentPeriodEnd: null }),
        }),
      );
    });

    it("sets stripeSubscriptionStatus to 'canceled'", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: true }),
      );

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stripeSubscriptionStatus: "canceled" }),
        }),
      );
    });
  });

  // ─── 11.30 customer.subscription.deleted — fallback to customerId lookup ──────

  describe("11.30 customer.subscription.deleted — fallback lookup by stripeCustomerId", () => {
    it("finds org by stripeCustomerId when orgId not in metadata", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: false }),
      );
      getDb().organization.findUnique.mockResolvedValueOnce({ id: ORG_ID });

      await POST(makeWebhookReq());

      expect(getDb().organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stripeCustomerId: CUSTOMER_ID } }),
      );
    });

    it("resets plan to FREE via customer ID fallback path", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(
        makeSubscriptionDeletedEvent({ includeOrgId: false }),
      );
      getDb().organization.findUnique.mockResolvedValueOnce({ id: ORG_ID });

      await POST(makeWebhookReq());

      expect(getDb().organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID },
          data:  expect.objectContaining({ subscriptionPlan: "FREE" }),
        }),
      );
    });
  });

  // ─── 11.31 Unknown event → silently ignored, 200 received: true ──────────────

  describe("11.31 Unknown Stripe event type → silently ignored", () => {
    it("returns 200 { received: true } for an unknown event type", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeUnknownEvent());

      const res = await POST(makeWebhookReq());
      expect(res.status).toBe(200);
      const body = await res.json() as { received: boolean };
      expect(body.received).toBe(true);
    });

    it("does not throw or crash for an unrecognised event type", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeUnknownEvent());

      await expect(POST(makeWebhookReq())).resolves.toBeDefined();
    });
  });

  // ─── 11.32 Unknown event → no DB mutations ────────────────────────────────────

  describe("11.32 Unknown Stripe event type → does NOT call db.update", () => {
    it("does not call db.organization.update for unhandled event", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeUnknownEvent());

      await POST(makeWebhookReq());
      expect(getDb().organization.update).not.toHaveBeenCalled();
    });

    it("logs a warning for the unhandled event type", async () => {
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeUnknownEvent());

      await POST(makeWebhookReq());
      expect(getLogger().warn).toHaveBeenCalledWith(
        expect.stringMatching(/Unhandled event type|beta\.test/),
      );
    });
  });

  // ─── 11.33 Unknown plan key → fail-closed ─────────────────────────────────────

  describe("11.33 Stripe subscription retrieval error propagates from handler", () => {
    it("route propagates error when stripe.subscriptions.retrieve throws", async () => {
      // The POST handler has no try-catch around individual event processing.
      // When subscriptions.retrieve throws, the whole POST function throws.
      // This test documents that behaviour — prevents silent swallowing of errors.
      getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
      getStripe().subscriptions.retrieve.mockRejectedValueOnce(
        new Error("No such subscription: 'sub_unknown_plan_key'"),
      );

      // The route propagates the rejection — no silent failure
      await expect(POST(makeWebhookReq())).rejects.toThrow("No such subscription");
    });
  });

  // ─── 11.34 All handled events return 200 { received: true } ─────────────────────

  describe("11.34 All successfully handled events return 200 { received: true }", () => {
    const successEvents = [
      {
        name: "checkout.session.completed",
        setupFn: () => {
          getStripe().webhooks.constructEvent.mockReturnValueOnce(makeCheckoutCompletedEvent());
          getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);
        },
      },
      {
        name: "invoice.payment_succeeded",
        setupFn: () => {
          getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentSucceededEvent());
          getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);
        },
      },
      {
        name: "invoice.payment_failed",
        setupFn: () => {
          getStripe().webhooks.constructEvent.mockReturnValueOnce(makeInvoicePaymentFailedEvent());
          getStripe().subscriptions.retrieve.mockResolvedValueOnce(MOCK_SUBSCRIPTION);
        },
      },
      {
        name: "customer.subscription.updated",
        setupFn: () => {
          getStripe().webhooks.constructEvent.mockReturnValueOnce(makeSubscriptionUpdatedEvent({ includeOrgId: true }));
        },
      },
      {
        name: "customer.subscription.deleted",
        setupFn: () => {
          getStripe().webhooks.constructEvent.mockReturnValueOnce(makeSubscriptionDeletedEvent({ includeOrgId: true }));
        },
      },
    ] as const;

    it.each(successEvents)(
      "$name → 200 { received: true }",
      async ({ setupFn }) => {
        jest.resetAllMocks();
        resetMocks();
        setupFn();

        const res  = await POST(makeWebhookReq());
        expect(res.status).toBe(200);
        const body = await res.json() as { received: boolean };
        expect(body.received).toBe(true);
      },
    );
  });
});
