import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    logger.error("Stripe webhook signature validation failed", { error });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Handle different event types
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;

      if (!orgId) {
        logger.error("[WEBHOOK] Missing orgId in checkout session metadata");
        break;
      }

      // Get subscription details with proper type casting
      const subscriptionResponse = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      
      // Access properties safely - Stripe SDK returns Response<Subscription>
      const subscription: any = subscriptionResponse;

      // Update organization with subscription details
      await db.organization.update({
        where: { id: orgId },
        data: {
          subscriptionPlan: "PRO",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionStatus: subscription.status,
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000)
            : null,
        },
      });

      logger.webhook("checkout.session.completed", "success", { orgId });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice: any = event.data.object;
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : invoice.subscription?.id;

      if (!subscriptionId) break;

      // Get subscription and organization with proper type casting
      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
      const subscription: any = subscriptionResponse;
      const orgId = subscription.metadata?.orgId;

      if (orgId) {
        // Update subscription period end date
        await db.organization.update({
          where: { id: orgId },
          data: {
            stripeSubscriptionStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
          },
        });

        logger.webhook("invoice.payment_succeeded", "success", { orgId });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice: any = event.data.object;
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : invoice.subscription?.id;

      if (!subscriptionId) break;

      const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
      const subscription: any = subscriptionResponse;
      const orgId = subscription.metadata?.orgId;

      if (orgId) {
        await db.organization.update({
          where: { id: orgId },
          data: {
            stripeSubscriptionStatus: "past_due",
          },
        });

        logger.webhook("invoice.payment_failed", "error", { orgId });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription: any = event.data.object;
      const orgId = subscription.metadata?.orgId;

      if (!orgId) {
        // Try to find org by customer ID
        const org = await db.organization.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (org) {
          await db.organization.update({
            where: { id: org.id },
            data: {
              stripeSubscriptionStatus: subscription.status,
              stripeCurrentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
        }
      } else {
        await db.organization.update({
          where: { id: orgId },
          data: {
            stripeSubscriptionStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
          },
        });
      }

      logger.webhook("customer.subscription.updated", "success", { orgId });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription: any = event.data.object;
      const orgId = subscription.metadata?.orgId;

      if (!orgId) {
        // Try to find org by customer ID
        const org = await db.organization.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (org) {
          await db.organization.update({
            where: { id: org.id },
            data: {
              subscriptionPlan: "FREE",
              stripeSubscriptionStatus: "canceled",
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });

          logger.webhook("customer.subscription.deleted", "success", { orgId: org.id });
        }
      } else {
        await db.organization.update({
          where: { id: orgId },
          data: {
            subscriptionPlan: "FREE",
            stripeSubscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });

        logger.webhook("customer.subscription.deleted", "success", { orgId });
      }
      break;
    }

    default:
      logger.warn(`[WEBHOOK] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
