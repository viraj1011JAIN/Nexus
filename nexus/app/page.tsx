import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.vercel.app";

export const metadata: Metadata = {
  title: "NEXUS — Enterprise Project Management",
  description:
    "NEXUS is a production-grade, multi-tenant project management platform. Real-time Kanban boards, sprints, analytics, and team collaboration — self-hostable and Trello/Jira-alternative.",
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: APP_URL,
    siteName: "NEXUS",
    title: "NEXUS — Enterprise Project Management",
    description:
      "Real-time Kanban boards, sprints, analytics, and multi-tenant team collaboration. The self-hostable Jira/Trello alternative built with Next.js 15 + AI.",
    images: [
      {
        url: `${APP_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "NEXUS — Enterprise Project Management dashboard",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@nexus_app",
    creator: "@viraj_jain_dev",
    title: "NEXUS — Enterprise Project Management",
    description:
      "Production-grade multi-tenant project management. Real-time boards, sprints, analytics and AI — built for teams.",
    images: [`${APP_URL}/og-image.jpg`],
  },
};

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