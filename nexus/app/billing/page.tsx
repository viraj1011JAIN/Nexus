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

  return <BillingClient organization={organization} />;
}
