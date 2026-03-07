import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Syne, Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { validateEnv } from "@/lib/env";

// Validate required env vars at server startup — throws clearly if misconfigured
validateEnv();

import { ModalProvider } from "@/components/providers/modal-provider";
import { SonnerProvider } from "@/components/providers/sonner-provider";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { PerformanceWrapper } from "@/components/performance-wrapper";
import { CommandPaletteProvider } from "@/components/providers/command-palette-provider";
import { Toaster } from "@/components/ui/toaster";
import { AriaLiveRegion } from "@/components/accessibility/aria-live-region";
import { NavigationErrorGuard } from "@/components/navigation-error-guard";
import { NexusIntro } from "@/components/nexus-intro";
import "./globals.css";
// editor.css is imported directly in rich-text-editor.tsx — no longer global

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["600", "700", "800"],
});

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
  // Only used on the landing page — don't generate preload tags for every app route
  preload: false,
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700"],
  // Only used on the landing page — don't generate preload tags for every app route
  preload: false,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexus.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "NEXUS — Enterprise Project Management",
    template: "%s | NEXUS",
  },
  description:
    "NEXUS is a production-grade, multi-tenant project management platform. Real-time Kanban boards, sprints, analytics, and team collaboration — self-hostable and Trello/Jira-alternative.",
  keywords: [
    "project management", "kanban", "task management", "team collaboration",
    "sprint planning", "agile", "saas", "nexus", "jira alternative", "trello alternative",
  ],
  authors: [{ name: "Viraj Jain", url: APP_URL }],
  creator: "Viraj Jain",
  publisher: "NEXUS",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  manifest: "/manifest.json",
  icons: {
    icon: [
      // SVG is resolution-independent and preferred by all modern browsers
      { url: "/favicon.svg", type: "image/svg+xml" },
      // PNG fallbacks for older browsers / OS-level bookmarks
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: APP_URL,
    siteName: "NEXUS",
    title: "NEXUS — Enterprise Project Management",
    description:
      "Real-time Kanban boards, sprints, analytics, and multi-tenant team collaboration. The self-hostable Jira/Trello alternative built with Next.js 15 + AI.",
    // images intentionally omitted — auto-resolved from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    site: "@nexus_app",
    creator: "@viraj_jain_dev",
    title: "NEXUS — Enterprise Project Management",
    description:
      "Production-grade multi-tenant project management. Real-time boards, sprints, analytics and AI — built for teams.",
    // images intentionally omitted — auto-resolved from app/opengraph-image.tsx
  },
  verification: {
    // Replace this placeholder with the string from Google Search Console
    // (Settings → Ownership verification → HTML tag method)
    google: "REPLACE_WITH_GOOGLE_SITE_VERIFICATION_STRING",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NEXUS",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en" suppressHydrationWarning>
        <head>
          {/*
           * next/font/google (DM_Sans, Playfair_Display, Syne, Outfit) automatically
           * injects the required preconnect / preload link tags for
           * fonts.googleapis.com and fonts.gstatic.com, so manual <link> tags
           * for those are redundant and would trigger @next/next/google-font-preconnect.
           *
           * The hints below target third-party origins that next/font does NOT handle.
           */}

          {/* Clerk Frontend API — hosts clerk.browser.js (the main Clerk JS bundle) */}
          <link rel="preconnect" href="https://clerk.accounts.dev" />
          <link rel="dns-prefetch" href="https://clerk.accounts.dev" />

          {/* Clerk CDN — user avatars appear in every authenticated page header */}
          <link rel="preconnect" href="https://img.clerk.com" />
          <link rel="dns-prefetch" href="https://img.clerk.com" />

          {/* Stripe — loaded on billing / checkout pages */}
          <link rel="dns-prefetch" href="https://js.stripe.com" />
          <link rel="dns-prefetch" href="https://api.stripe.com" />

          {/* Unsplash — default board cover images */}
          <link rel="dns-prefetch" href="https://images.unsplash.com" />
          <link rel="dns-prefetch" href="https://plus.unsplash.com" />

          {/* GitHub & Google — OAuth avatar sources */}
          <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
          <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />

          {/* Inline theme script - runs before paint to prevent FOUC */}
          <script
            suppressHydrationWarning
            id="theme-script"
            dangerouslySetInnerHTML={{ __html: themeScript }}
          />

          {/* Viewport – allow pinch-zoom for accessibility (max-scale ≥ 5) */}
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        </head>
        <body className={`${dmSans.variable} ${playfairDisplay.variable} ${syne.variable} ${outfit.variable} ${dmSans.className} antialiased`} suppressHydrationWarning>
          {/* Skip navigation link — keyboard / screen-reader UX (TASK-036) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-white"
          >
            Skip to main content
          </a>
          {/* Brand splash animation — shown once per session, respects prefers-reduced-motion */}
          <NexusIntro />
          <PerformanceWrapper>
            <ThemeProvider>
              {/*
               * NOTE: contain-layout was intentionally removed.
               * CSS `contain: layout` creates a new containing block for
               * position:fixed descendants (CSS Containment spec §3.3),
               * which caused the landing page nav and About page floating
               * nav to scroll with the page rather than stick to the viewport.
               */}
              <div id="main-content" tabIndex={-1} className="bg-background text-foreground min-h-screen focus-visible:outline-none" suppressHydrationWarning>
                <NavigationErrorGuard />
                <AriaLiveRegion />
                <CommandPaletteProvider />
                <ModalProvider />
                <Toaster />
                <SonnerProvider />
                {children}
              </div>
            </ThemeProvider>
          </PerformanceWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}