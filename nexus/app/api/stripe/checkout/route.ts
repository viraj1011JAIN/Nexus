import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { 
          error: "Stripe is not configured. Please add STRIPE_SECRET_KEY, STRIPE_PRO_MONTHLY_PRICE_ID, and STRIPE_PRO_YEARLY_PRICE_ID to your .env.local file. See STRIPE_SETUP_UK.md for instructions." 
        },
        { status: 503 }
      );
    }

    const { orgId } = await auth();
    
    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    }

    // Get organization from database
    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if organization already has a Stripe customer
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          orgId: organization.id,
          orgName: organization.name,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await db.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Stripe Checkout Session (UK/GBP)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      currency: "gbp",
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      metadata: {
        orgId: organization.id,
        orgName: organization.name,
      },
      allow_promotion_codes: true,
      tax_id_collection: {
        enabled: true, // Allow UK VAT collection
      },
      // Terms of service - Only enable if you've set a URL in Stripe Dashboard
      // Go to: https://dashboard.stripe.com/settings/public
      // consent_collection: {
      //   terms_of_service: "required",
      // },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("Stripe checkout session creation failed", { error, orgId: (await auth()).orgId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
