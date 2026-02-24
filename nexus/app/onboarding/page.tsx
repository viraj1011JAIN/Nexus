import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export const metadata = { title: "Get Started | NEXUS" };

/**
 * Onboarding wizard page (TASK-034).
 *
 * New users land here automatically — wire a post-sign-up redirect in your
 * Clerk dashboard or middleware: afterSignUpUrl="/onboarding".
 *
 * Returning users who revisit /onboarding get the same flow (idempotent
 * board creation is handled in the action with a LIMIT_REACHED guard).
 */
export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userName = user.firstName ?? user.username ?? "";

  return <OnboardingClient userName={userName} />;
}
