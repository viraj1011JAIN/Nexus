import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Sidebar } from "@/components/layout/sidebar";
import { ModalProvider } from "@/components/providers/modal-provider"; // [FIXED: Critical import]
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NEXUS | Enterprise Task Management",
  description: "Production-level B2B SaaS Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        {/* CRITICAL FIX: The ModalProvider must be rendered at the root level 
            to ensure that Dialogs and Modals can mount properly across the app.
        */}
        <ModalProvider />
        <Toaster />
        <CommandPalette />

        <div className="flex h-screen w-full overflow-hidden"> 
            
            {/* THE SIDEBAR:
                Occupies a fixed horizontal space in the flex container.
                It is a direct child of the flex container to prevent overlap.
            */}
            <Sidebar />

            {/* MAIN CONTENT AREA:
                1. 'flex-1': Automatically fills the remaining width next to the sidebar.
                2. 'overflow-y-auto': Isolates scrolling to the board/content area only.
                3. 'relative': Establishes the stacking context for nested UI elements.
            */}
            <main className="flex-1 h-full overflow-y-auto relative bg-slate-50">
               <div className="p-8 min-h-full">
                  {children}
               </div>
            </main>
        </div>
      </body>
    </html>
  );
}