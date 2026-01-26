import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BillingClient } from "@/components/billing-client";

export default async function BillingPage() {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/");
  }

  const organization = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      boards: true,
    },
  });

  if (!organization) {
    redirect("/");
  }

  return (
    <BillingClient
      organization={{
        id: organization.id,
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan,
        stripeCustomerId: organization.stripeCustomerId,
        stripeSubscriptionStatus: organization.stripeSubscriptionStatus,
        stripeCurrentPeriodEnd: organization.stripeCurrentPeriodEnd,
        boardCount: organization.boards.length,
      }}
    />
  );
}
