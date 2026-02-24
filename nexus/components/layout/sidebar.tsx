"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Plus, Moon, Sun, Monitor } from "lucide-react";
import { usePathname } from "next/navigation";

const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then((m) => m.OrganizationSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="h-7 w-full rounded-md bg-muted animate-pulse" />
    ),
  }
);
const UserButton = dynamic(
  () => import("@clerk/nextjs").then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
    ),
  }
);
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/layout/notification-center";

export const Sidebar = () => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const routes = [
    { label: "Boards",   icon: Layout,     href: `/dashboard`, active: pathname === "/dashboard" },
    { label: "Activity", icon: Activity,   href: `/activity`,  active: pathname === "/activity"  },
    { label: "Settings", icon: Settings,   href: `/settings`,  active: pathname === "/settings"  },
    { label: "Billing",  icon: CreditCard, href: `/billing`,   active: pathname === "/billing"   },
  ];

  const themeOptions = [
    { value: "light",  icon: Sun,     label: "Light"  },
    { value: "dark",   icon: Moon,    label: "Dark"   },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  const activeTheme = themeOptions.find((t) => t.value === theme) ?? themeOptions[0];
  const ThemeIcon = activeTheme.icon;

  return (
    <div className="w-72 h-full bg-sidebar border-r border-sidebar-border flex flex-col shadow-soft shrink-0 z-20">

      {/* ── Brand + Org selector ──────────────────────────────────────────── */}
      <div className="px-6 pt-7 pb-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-700 to-purple-500 flex items-center justify-center shadow-sm">
              <div className="w-3.5 h-3.5 rounded-sm bg-white/25" />
            </div>
            {/* Brand name — gradient text using design token class */}
            <span className="font-bold text-xl tracking-tight gradient-text">
              NEXUS
            </span>
          </div>

          {/* Quick-add button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Organization Selector — inline styles use CSS vars so they auto-switch themes */}
        <div className="mt-1">
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/dashboard"
            afterLeaveOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: {
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: "100%",
                },
                organizationSwitcherTrigger: {
                  padding: "10px 12px",
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid rgb(var(--border))",
                  justifyContent: "space-between",
                  backgroundColor: "rgb(var(--muted))",
                  color: "rgb(var(--foreground))",
                  fontSize: "13px",
                  fontWeight: "500",
                  transition: "border-color 150ms ease",
                },
                organizationSwitcherTriggerIcon: {
                  width: "28px",
                  height: "28px",
                },
              },
            }}
          />
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pt-5 pb-4 space-y-0.5">
        {routes.map((route, index) => (
          <motion.div
            key={route.href}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, delay: index * 0.04 }}
          >
            <Link
              href={route.href}
              className={cn(
                "group relative flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-all duration-150",
                route.active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {/* Active indicator pill */}
              {route.active && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}

              <route.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-150",
                  route.active
                    ? "text-primary"
                    : "text-muted-foreground/70 group-hover:text-foreground"
                )}
              />
              <span>{route.label}</span>
            </Link>
          </motion.div>
        ))}
      </nav>

      {/* ── Footer: Theme + User ──────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">

        {/* Theme picker (dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              suppressHydrationWarning
              className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
            >
              {mounted && <ThemeIcon className="h-4 w-4 shrink-0" />}
              <span suppressHydrationWarning>
                {mounted ? activeTheme.label + " Mode" : "Theme"}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm",
                  theme === value
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {theme === value && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar + notifications + settings */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: {
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  border: "2px solid rgba(var(--primary), 0.4)",
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
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
