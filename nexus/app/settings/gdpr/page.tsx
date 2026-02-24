import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import GdprClient from "./gdpr-client";

/**
 * Settings › Privacy & Data Rights (GDPR)
 *
 * Provides the data-subject rights mandated by GDPR:
 *   • Right to portability (export)
 *   • Right to erasure (deletion request)
 *   • Cookie / consent management
 *   • Links to legal documents
 */
export const metadata = { title: "Privacy & Data Rights | NEXUS Settings" };

export default async function GdprPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userName = user?.fullName ?? user?.username ?? "";

  return <GdprClient userEmail={userEmail} userName={userName} />;
}
