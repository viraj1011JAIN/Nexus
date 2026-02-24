import { currentUser } from "@clerk/nextjs/server";
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
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Resolve the primary email via primaryEmailAddressId for accuracy.
  const primaryAddress = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  );
  const userEmail = primaryAddress?.emailAddress ?? "";

  // Build display name from first+last, fall back to username.
  const nameParts = [user.firstName, user.lastName].filter(Boolean);
  const userName = nameParts.length > 0 ? nameParts.join(" ") : (user.username ?? "");

  return <GdprClient userEmail={userEmail} userName={userName} />;
}
