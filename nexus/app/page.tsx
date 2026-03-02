import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

/**
 * Landing page — Server Component wrapper.
 *
 * Checking auth server-side means:
 *  - No flash of empty content while Clerk loads client-side
 *  - No client JS required for the redirect path (instant HTTP 307)
 *  - Signed-in users never see the marketing page
 *
 * All interactive content (custom cursor, canvas nebula, scroll reveals,
 * parallax 3D boards) lives in the LandingPage client component.
 */
export default async function LandingPageRoute() {
  const { userId } = await auth();

  // Redirect authenticated users straight to the app — no client JS needed
  if (userId) redirect("/dashboard");

  return <LandingPage />;
}