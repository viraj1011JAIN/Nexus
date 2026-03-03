import type { Metadata } from "next";
import AboutPage from "@/components/landing/AboutPage";

export const metadata: Metadata = {
  title: "About NEXUS — Architecture, Facts & Technology",
  description:
    "The engineering story behind NEXUS: 57 API routes, 28+ RBAC permissions, 1,512+ tests, <50ms real-time latency. A production-grade multi-tenant project management platform.",
  openGraph: {
    title: "About NEXUS",
    description:
      "Real facts, architecture decisions, and the technology stack behind NEXUS — a self-hostable Jira/Trello alternative.",
    type: "website",
  },
};

/**
 * About page — Server Component wrapper.
 *
 * All interactive content (canvas particle bg, animated counters, framer-motion
 * scroll animations, sticky nav) lives in the AboutPage client component.
 */
export default function AboutRoute() {
  return <AboutPage />;
}
