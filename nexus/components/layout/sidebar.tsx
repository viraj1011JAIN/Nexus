"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Layout,
  Settings,
  Activity,
  CreditCard,
  Plus,
  AlertTriangle,
  HardDrive,
} from "lucide-react";
import { usePathname } from "next/navigation";

const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then((m) => m.OrganizationSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
    ),
  }
);
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
    ),
  }
);
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { NotificationCenter } from "@/components/layout/notification-center";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const routes = [
  { label: "Boards",   icon: Layout,     href: `/dashboard` },
  { label: "Activity", icon: Activity,   href: `/activity`  },
  { label: "Settings", icon: Settings,   href: `/settings`  },
  { label: "Billing",  icon: CreditCard, href: `/billing`   },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [boardCount, setBoardCount] = useState(0);
  const [boardLimit, setBoardLimit] = useState(50);
  const [showStorageFullDialog, setShowStorageFullDialog] = useState(false);

  const fetchBoardCount = useCallback(async () => {
    try {
      const res = await fetch("/api/boards");
      if (res.ok) {
        const data = await res.json();
        setBoardCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      // silently fail — sidebar remains functional
    }
  }, []);

  useEffect(() => {
    fetchBoardCount();
  }, [fetchBoardCount]);

  // Re-fetch when navigating (boards may have been created/deleted)
  useEffect(() => {
    fetchBoardCount();
  }, [pathname, fetchBoardCount]);

  const storagePercent = boardLimit === Infinity ? 0 : Math.min(Math.round((boardCount / boardLimit) * 100), 100);
  const isStorageFull = boardCount >= boardLimit && boardLimit !== Infinity;

  return (
    <>
    {/* Storage Full Dialog */}
    <Dialog open={showStorageFullDialog} onOpenChange={setShowStorageFullDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <DialogTitle className="text-center text-lg">Storage Limit Reached</DialogTitle>
          <DialogDescription className="text-center text-sm">
            You&apos;ve used all <span className="font-semibold text-foreground">{boardLimit}</span> boards on the Free plan.
            Upgrade to Pro for unlimited boards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {/* Usage bar */}
          <div className="bg-muted rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Boards Used</span>
              <span className="text-xs font-bold text-red-500">{boardCount} / {boardLimit}</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 w-full" />
            </div>
          </div>
          <Button asChild className="w-full bg-gradient-to-r from-[#7B2FF7] to-[#C01CC4] hover:opacity-90 text-white">
            <Link href="/billing">Upgrade to Pro</Link>
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowStorageFullDialog(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-20 select-none relative overflow-hidden">
      {/* Rainbow shimmer stripe */}
      <div className="shimmer-stripe absolute top-0 left-0 right-0 h-[3px] z-10" />

      {/* == Brand Header ================================================== */}
      <div className="px-5 pt-7 pb-5 border-b border-sidebar-border">

        {/* Logo + App name + quick-add */}
        <div className="flex items-center gap-3 mb-5">
          {/* Gradient logo mark with "N" lettermark */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#7B2FF7] to-[#F107A3] shadow-[0_6px_20px_rgba(123,47,247,0.35)]"
          >
            <span className="text-white font-bold text-[17px] leading-none tracking-tight select-none font-display">N</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[15px] text-foreground leading-tight tracking-tight">
              Nexus
            </p>
            <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5 tracking-wide">
              Project Management
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            aria-label="Quick create"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Organization Switcher */}
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/dashboard"
          afterLeaveOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { display: "flex", width: "100%" },
              organizationSwitcherTrigger: {
                padding: "8px 10px",
                width: "100%",
                borderRadius: "8px",
                border: "1px solid rgb(var(--border))",
                justifyContent: "space-between",
                backgroundColor: "rgb(var(--muted))",
                color: "rgb(var(--foreground))",
                fontSize: "13px",
                fontWeight: "500",
                transition: "all 150ms ease",
              },
              organizationSwitcherTriggerIcon: {
                color: "rgb(var(--foreground))",
              },
              organizationPreview: {
                color: "rgb(var(--foreground))",
              },
              organizationSwitcherPopoverCard: {
                background: "rgb(var(--popover))",
                border: "1px solid rgb(var(--border))",
                color: "rgb(var(--popover-foreground))",
              },
              organizationSwitcherPopoverActionButton: {
                color: "rgb(var(--foreground))",
              },
              organizationSwitcherPopoverActionButtonText: {
                color: "rgb(var(--foreground))",
              },
              organizationSwitcherPopoverActionButtonIcon: {
                color: "rgb(var(--foreground))",
              },
            },
          }}
        />
      </div>

      {/* == Navigation ==================================================== */}
      <nav className="flex-1 px-3 pt-4 pb-3 space-y-0.5 overflow-y-auto">
        {routes.map((route, index) => {
          const isActive = pathname === route.href;
          return (
            <motion.div
              key={route.href}
              initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15, delay: prefersReducedMotion ? 0 : index * 0.04 }}
            >
              <Link
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 px-2.5 py-2.25 rounded-lg text-[13.5px] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/40 font-normal"
                )}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span
                    className="absolute left-0 top-[18%] bottom-[18%] w-[3px] rounded-r-full bg-gradient-to-b from-[#7B2FF7] to-[#C01CC4]"
                  />
                )}

                <route.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-150",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/60 group-hover:text-foreground"
                  )}
                />
                <span>{route.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* == Footer ======================================================= */}
      <div className="border-t border-sidebar-border">
      {/* Storage usage meter — live board count */}
      <button
        type="button"
        onClick={() => { if (isStorageFull) setShowStorageFullDialog(true); }}
        className={cn(
          "w-full text-left px-5 py-3 border-b border-sidebar-border transition-colors",
          isStorageFull && "cursor-pointer hover:bg-muted/60"
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <HardDrive className="h-3 w-3" />
            Storage
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold",
              isStorageFull ? "text-red-500" : storagePercent >= 80 ? "text-amber-500" : "text-foreground"
            )}
          >
            {boardCount} / {boardLimit === Infinity ? "\u221E" : boardLimit} boards
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={storagePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Storage usage: ${storagePercent}% (${boardCount} of ${boardLimit === Infinity ? "unlimited" : boardLimit} boards)`}
          className="h-1.5 bg-muted rounded-full overflow-hidden"
        >
          <div
            aria-hidden="true"
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isStorageFull
                ? "bg-gradient-to-r from-red-500 to-orange-500"
                : storagePercent >= 80
                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                  : "bg-gradient-to-r from-[#7B2FF7] to-[#C01CC4]"
            )}
            style={{ width: `${Math.max(storagePercent, 2)}%` }}
          />
        </div>
        {isStorageFull && (
          <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Limit reached — upgrade for more
          </p>
        )}
      </button>
      <div className="px-3 pt-3 pb-4 space-y-0.5">

        {/* User avatar + notifications + settings */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: {
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                },
              },
            }}
          />
          <div className="flex-1" />
          <NotificationCenter />
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
          >
            <Link href="/settings" aria-label="Open settings">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
      </div>
    </aside>
    </>
  );
};