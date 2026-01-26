import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { Sidebar } from "@/components/layout/sidebar";
import { ModalProvider } from "@/components/providers/modal-provider";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEXUS | Enterprise Task Management",
  description: "Production-level B2B SaaS Platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth();

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} bg-slate-50 antialiased`}>
          <ModalProvider />
          <Toaster />
          {userId && <CommandPalette />}

          {userId ? (
            <div className="flex h-screen w-full overflow-hidden"> 
              <Sidebar />
              <main className="flex-1 h-full overflow-y-auto relative bg-slate-50">
                <div className="p-8 min-h-full">
                  {children}
                </div>
              </main>
            </div>
          ) : (
            <main className="w-full h-full">
              {children}
            </main>
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}