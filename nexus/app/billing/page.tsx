import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import BillingClient from "./billing-client";

export default async function BillingPage() {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/");
  }

  const organization = await db.organization.findUnique({
    where: { id: orgId },
  });

  if (!organization) {
    redirect("/");
  }

  // Check if Stripe is configured on the server side
  const isStripeConfigured = !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID &&
    process.env.STRIPE_PRO_YEARLY_PRICE_ID
  );

  const priceIds = {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
  };

  return (
    <BillingClient 
      organization={organization} 
      isStripeConfigured={isStripeConfigured}
      priceIds={priceIds}
    />
  );
}
