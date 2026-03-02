import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Syne, Outfit } from "next/font/google";
import LandingPage from "@/components/landing/LandingPage";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600"],
});

/**
 * Landing page — Server Component.
 *
 * Checking auth server-side means:
 *  - No flash of empty content while Clerk loads client-side
 *  - No client JS required for the redirect path (instant HTTP 307)
 *  - Signed-in users never see the marketing page
 */
export default async function Page() {
  const { userId } = await auth();

  // Redirect authenticated users straight to the app — no client JS needed
  if (userId) redirect("/dashboard");

  return (
    <div className={`${syne.variable} ${outfit.variable}`}>
      <LandingPage />
    </div>
  );
}