"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Layout,
  Settings,
  Activity,
  CreditCard,
  Plus,
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
import { motion } from "framer-motion";
import { NotificationCenter } from "@/components/layout/notification-center";

const routes = [
  { label: "Boards",   icon: Layout,     href: `/dashboard` },
  { label: "Activity", icon: Activity,   href: `/activity`  },
  { label: "Settings", icon: Settings,   href: `/settings`  },
  { label: "Billing",  icon: CreditCard, href: `/billing`   },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-20 select-none relative overflow-hidden">
      {/* Rainbow shimmer stripe */}
      <div className="shimmer-stripe absolute top-0 left-0 right-0 h-0.75 z-10" />

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
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: index * 0.04 }}
            >
              <Link
                href={route.href}
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
      {/* Storage usage meter */}
      <div className="px-5 py-3 border-b border-sidebar-border">
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Storage</span>
          <span className="text-[11px] text-foreground font-semibold">24%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full w-[24%] bg-gradient-to-r from-[#7B2FF7] to-[#C01CC4]"
          />
        </div>
      </div>
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
  );
};