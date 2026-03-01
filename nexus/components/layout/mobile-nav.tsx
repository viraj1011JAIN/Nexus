"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then((m) => m.OrganizationSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="h-7 w-32 rounded-md bg-muted animate-pulse" />
    ),
  }
);
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
    ),
  }
);
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  
  const routes = [
    { label: "Boards", icon: Layout, href: `/dashboard`, active: pathname === "/dashboard" },
    { label: "Activity", icon: Activity, href: `/activity`, active: pathname === "/activity" },
    { label: "Settings", icon: Settings, href: `/settings`, active: pathname === "/settings" },
    { label: "Billing", icon: CreditCard, href: `/billing`, active: pathname === "/billing" },
  ];

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-b border-border z-50 flex items-center justify-between px-4 transition-all duration-200">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7B2FF7] to-[#F107A3] shadow-[0_6px_20px_rgba(123,47,247,0.35)]"
          >
            <span className="text-white font-bold text-[17px] leading-none select-none font-display">N</span>
          </div>
          <span className="text-[15px] font-display font-bold text-foreground tracking-tight">
            Nexus
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/sign-in" />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              onClick={closeMenu}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 top-16 touch-manipulation"
            />

            {/* Menu */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ 
                type: "spring", 
                damping: 30, 
                stiffness: 300,
                mass: 0.8
              }}
              className="lg:hidden fixed right-0 top-16 bottom-0 w-72 bg-card/98 backdrop-blur-xl border-l border-border z-40 shadow-2xl overflow-y-auto overscroll-contain"
            >
              <div className="p-6 space-y-8">
                {/* Organization Switcher */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Organization
                  </p>
                  <OrganizationSwitcher
                    hidePersonal
                    afterCreateOrganizationUrl="/dashboard"
                    afterSelectOrganizationUrl="/dashboard"
                    appearance={{
                      elements: {
                        rootBox: {
                          width: "100%",
                        },
                      },
                    }}
                  />
                </div>

                {/* Navigation Links */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Navigation
                  </p>
                  <nav className="space-y-1">
                    {routes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={closeMenu}
                          className={cn(
                            "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 touch-manipulation min-h-12",
                            route.active
                              ? "bg-accent text-accent-foreground font-semibold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {route.active && (
                            <span
                              className="absolute left-0 top-[18%] bottom-[18%] w-[3px] rounded-r-full bg-gradient-to-b from-[#7B2FF7] to-[#C01CC4]"
                            />
                          )}
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="text-[15px] font-medium">{route.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for mobile header */}
      <div className="lg:hidden h-16" />
    </>
  );
};
