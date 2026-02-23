import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";

import { ModalProvider } from "@/components/providers/modal-provider";
import { SonnerProvider } from "@/components/providers/sonner-provider";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { PerformanceWrapper } from "@/components/performance-wrapper";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import "./editor.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
          {/* DNS Prefetch for external resources */}
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
          {/* eslint-disable-next-line @next/next/google-font-preconnect */}
          <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
          
          {/* Preconnect to critical origins */}
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          
          {/* Optimized theme script - runs before paint */}
          <Script
            id="theme-script"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: themeScript }}
          />
          
          {/* Viewport optimization for better mobile performance */}
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        </head>
        <body className={inter.className} suppressHydrationWarning>
          <PerformanceWrapper>
            <ThemeProvider>
              <div className="bg-background text-foreground min-h-screen contain-layout" suppressHydrationWarning>
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