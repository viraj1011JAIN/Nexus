import type { Metadata } from "next";
import { Inter, DM_Sans, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";

import { ModalProvider } from "@/components/providers/modal-provider";
import { SonnerProvider } from "@/components/providers/sonner-provider";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { PerformanceWrapper } from "@/components/performance-wrapper";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/toaster";
import { AriaLiveRegion } from "@/components/accessibility/aria-live-region";
import "./globals.css";
import "./editor.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

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

export const metadata: Metadata = {
  title: "NEXUS | Enterprise Task Management",
  description: "Production-level B2B SaaS Platform",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NEXUS",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/*
           * next/font/google (Inter, DM_Sans, Playfair_Display) automatically
           * injects the required preconnect / preload link tags for
           * fonts.googleapis.com and fonts.gstatic.com, so manual <link> tags
           * here are redundant and would trigger @next/next/google-font-preconnect.
           */}

          {/* Optimized theme script - runs before paint to prevent FOUC */}
          <Script
            id="theme-script"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: themeScript }}
          />

          {/* Viewport – allow pinch-zoom for accessibility (max-scale ≥ 5) */}
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        </head>
        <body className={`${inter.variable} ${dmSans.variable} ${playfairDisplay.variable} ${dmSans.className} antialiased`} suppressHydrationWarning>
          {/* Skip navigation link — keyboard / screen-reader UX (TASK-036) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-white"
          >
            Skip to main content
          </a>
          <PerformanceWrapper>
            <ThemeProvider>
              <div id="main-content" tabIndex={-1} className="bg-background text-foreground min-h-screen contain-layout focus-visible:outline-none" suppressHydrationWarning>
                <AriaLiveRegion />
                <CommandPalette />
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