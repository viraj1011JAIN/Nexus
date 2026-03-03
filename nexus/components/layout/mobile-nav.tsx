"use client";

/**
 * MobileNavigation — Mobile-first navigation for viewports < 1024px
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  [TOP HEADER]  Logo        NotificationCenter + User    │  h-16, fixed top
 *   └─────────────────────────────────────────────────────────┘
 *   (page content — pt-16 pb-20 on mobile)
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  [BOTTOM NAV]  Boards │ Activity │ Settings │ More ⋯   │  h-14 + safe-area, fixed bottom
 *   └─────────────────────────────────────────────────────────┘
 *
 * The "More" tab opens a bottom sheet with the OrgSwitcher and
 * secondary routes (Billing).
 *
 * A11y:
 *  - All interactive elements ≥ 44×44 px (WCAG 2.5.5 AAA)
 *  - aria-current="page" on the active tab
 *  - Bottom sheet: role="dialog" + aria-modal="true" + Escape closes
 *  - Reduced-motion: spring anims disabled; opacity fades kept
 */

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Layout,
  Settings,
  Activity,
  CreditCard,
  MoreHorizontal,
  X,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { NotificationCenter } from "@/components/layout/notification-center";

// ── Clerk widgets — SSR-off to prevent hydration mismatches ──────────────────
const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then((m) => m.OrganizationSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full rounded-xl bg-muted animate-pulse" />
    ),
  }
);

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
    ),
  }
);

// ── Route config ─────────────────────────────────────────────────────────────

/** Top-level tabs shown permanently in the bottom bar. Max 3 to leave room for "More". */
const PRIMARY_TABS = [
  { label: "Boards",   icon: Layout,   href: "/dashboard" },
  { label: "Activity", icon: Activity, href: "/activity"  },
  { label: "Settings", icon: Settings, href: "/settings"  },
] as const;

/** Secondary routes — accessible from the "More" bottom sheet only. */
const MORE_ITEMS = [
  { label: "Billing", icon: CreditCard, href: "/billing" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export const MobileNav = () => {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // "More" tab is active when current route lives only in the sheet.
  const isMoreActive = MORE_ITEMS.some((item) => pathname === item.href);

  // Auto-focus sheet on open for keyboard/screen-reader users.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMoreOpen) {
      const id = setTimeout(() => sheetRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [isMoreOpen]);

  // Escape closes the sheet.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMoreOpen) setIsMoreOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMoreOpen]);

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          TOP HEADER — brand · notifications · user
          h-16 matches pt-16 layout spacer
      ════════════════════════════════════════════════════════ */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 h-16 z-50 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4"
        role="banner"
      >
        {/* Brand */}
        <Link
          href="/dashboard"
          aria-label="Nexus — Go to dashboard"
          className="flex items-center gap-2.5 rounded-lg p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#7B2FF7] to-[#F107A3] shadow-[0_6px_20px_rgba(123,47,247,0.35)]">
            <span className="text-white font-bold text-[17px] leading-none select-none font-display">N</span>
          </div>
          <span className="text-[15px] font-display font-bold text-foreground tracking-tight">Nexus</span>
        </Link>

        {/* Controls — each wrapped in a 44×44 tap-target container */}
        <div className="flex items-center">
          <div className="flex items-center justify-center min-h-[44px] min-w-[44px]">
            <NotificationCenter />
          </div>
          <div className="flex items-center justify-center min-h-[44px] min-w-[44px]">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: { width: "32px", height: "32px", borderRadius: "8px" },
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════
          BOTTOM NAVIGATION BAR — fixed, thumb-zone
          safe-area-inset-bottom pads for iOS home indicator
      ════════════════════════════════════════════════════════ */}
      <nav
        aria-label="Main navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {PRIMARY_TABS.map(({ label, icon: Icon, href }) => {
          const isActive =
            pathname === href ||
            (href === "/dashboard" && (pathname?.startsWith("/board/") ?? false));
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-[3px]",
                "min-h-[56px] py-2.5 px-1 touch-manipulation select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "transition-all duration-150 active:scale-90 active:opacity-70",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] shrink-0 transition-all duration-150",
                  isActive && "drop-shadow-[0_0_8px_rgba(123,47,247,0.5)]"
                )}
                aria-hidden="true"
              />
              <span className={cn(
                "text-[10px] font-semibold tracking-wide leading-none",
                isActive ? "text-primary" : "text-muted-foreground/60"
              )}>
                {label}
              </span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[18%] right-[18%] h-[3px] rounded-t-full bg-gradient-to-r from-[#7B2FF7] to-[#F107A3]"
                />
              )}
            </Link>
          );
        })}

        {/* "More" — opens bottom sheet */}
        <button
          type="button"
          aria-label="More navigation options"
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen(true)}
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center gap-[3px]",
            "min-h-[56px] py-2.5 px-1 touch-manipulation select-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            "transition-all duration-150 active:scale-90 active:opacity-70",
            isMoreOpen || isMoreActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-semibold tracking-wide leading-none text-muted-foreground/60">More</span>
          {isMoreActive && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[18%] right-[18%] h-[3px] rounded-t-full bg-gradient-to-r from-[#7B2FF7] to-[#F107A3]"
            />
          )}
        </button>
      </nav>

      {/* ════════════════════════════════════════════════════════
          "MORE" BOTTOM SHEET — secondary nav + org switcher
          Slides up over the bottom nav bar (z-[55] > z-50)
      ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            {/* Scrim */}
            <motion.div
              key="more-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
              aria-hidden="true"
              onClick={() => setIsMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="more-sheet"
              ref={sheetRef}
              role="dialog"
              aria-label="More navigation options"
              aria-modal="true"
              tabIndex={-1}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", damping: 34, stiffness: 400, mass: 0.85 }
              }
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[56] bg-card rounded-t-3xl border-t border-border shadow-2xl overflow-hidden focus-visible:outline-none"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="text-[16px] font-bold text-foreground">More</h2>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  aria-label="Close drawer"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors touch-manipulation active:scale-95"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Organisation switcher */}
              <div className="px-5 pb-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Organisation
                </p>
                <OrganizationSwitcher
                  hidePersonal
                  afterCreateOrganizationUrl="/dashboard"
                  afterSelectOrganizationUrl="/dashboard"
                  appearance={{
                    elements: {
                      rootBox: { width: "100%" },
                      organizationSwitcherTrigger: {
                        width: "100%",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        border: "1px solid rgb(var(--border))",
                        backgroundColor: "rgb(var(--muted))",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        fontWeight: "500",
                      },
                    },
                  }}
                />
              </div>

              <div className="h-px bg-border mx-5 mb-3" />

              {/* Secondary nav links */}
              <nav aria-label="Additional navigation" className="px-3 pb-4">
                {MORE_ITEMS.map(({ label, icon: Icon, href }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsMoreOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-2xl min-h-[60px]",
                        "transition-all duration-150 touch-manipulation active:scale-[0.98] active:opacity-75",
                        isActive
                          ? "bg-accent text-accent-foreground font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isActive ? "bg-primary/15" : "bg-muted"
                      )}>
                        <Icon
                          className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-muted-foreground")}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-[15px] flex-1 font-medium">{label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
