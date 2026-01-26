import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get organization
    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // User must have a Stripe customer ID
    if (!organization.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing information found" },
        { status: 400 }
      );
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    logger.error("Stripe portal session creation failed", { error, orgId: (await auth()).orgId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
