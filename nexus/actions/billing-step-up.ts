"use server";
import "server-only";

import { z } from "zod";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { createStepUpAction } from "@/lib/step-up-action";
import { logger } from "@/lib/logger";

/**
 * billing-step-up — Step-Up Protected Billing Actions
 *
 * Both Stripe operations (creating a checkout session and opening the billing
 * portal) are gated behind Clerk's 'moderate' reverification level (1-hour
 * window).  This prevents session-hijack attacks from silently upgrading or
 * cancelling a team's subscription.
 *
 * The 'moderate' level (vs 'strict' 10-min for deletes) is intentional:
 *   - Billing changes are less immediately catastrophic than data deletion
 *   - 1 hour matches typical checkout flow abandonment windows
 *   - Reduces friction for users managing multi-plan subscriptions
 *
 * These Server Actions replace the raw fetch('/api/stripe/checkout') and
 * fetch('/api/stripe/portal') calls in billing-client.tsx so that
 * `useReverification()` can intercept the reverification response shape.
 */

// ── Schemas ──────────────────────────────────────────────────────────────────

const InitCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, "Price ID is required"),
});

const InitBillingPortalSchema = z.object({});

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * initCheckoutSession
 *
 * Creates a Stripe Checkout Session for the caller's organisation and returns
 * the session URL for client-side redirect.  Mirrors the logic in
 * /api/stripe/checkout/route.ts but runs as a Server Action so that
 * `useReverification()` can gate it behind a re-auth challenge.
 *
 * Level: 'moderate' (1-hour window)
 */
export const initCheckoutSession = createStepUpAction(
  InitCheckoutSessionSchema,
  async ({ priceId }) => {
    if (!isStripeConfigured()) {
      return {
        error:
          "Stripe is not configured. Please add STRIPE_SECRET_KEY, STRIPE_PRO_MONTHLY_PRICE_ID, and STRIPE_PRO_YEARLY_PRICE_ID to your environment.",
      };
    }

    const { orgId } = await getTenantContext();

    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return { error: "Organisation not found." };
    }

    // Upsert Stripe customer
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId: organization.id, orgName: organization.name },
      });
      customerId = customer.id;
      await db.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      currency: "gbp",
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      metadata: { orgId: organization.id, orgName: organization.name },
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
    });

    logger.info("Stripe checkout session created via step-up action", {
      orgId,
      sessionId: session.id,
    });

    return { data: { url: session.url! } };
  },
  "moderate",
);

/**
 * initBillingPortal
 *
 * Opens the Stripe Customer Portal for the caller's organisation.  Requires
 * an existing Stripe customer ID (i.e. the org must have subscribed at least
 * once).  Mirrors /api/stripe/portal/route.ts as a Server Action.
 *
 * Level: 'moderate' (1-hour window)
 */
export const initBillingPortal = createStepUpAction(
  InitBillingPortalSchema,
  async () => {
    const { orgId } = await getTenantContext();

    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return { error: "Organisation not found." };
    }

    if (!organization.stripeCustomerId) {
      return { error: "No billing information found. Please subscribe first." };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    logger.info("Stripe portal session created via step-up action", {
      orgId,
    });

    return { data: { url: portalSession.url } };
  },
  "moderate",
);
