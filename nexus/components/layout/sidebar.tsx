"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Layout,
  Settings,
  Activity,
  CreditCard,
  Plus,
  Moon,
  Sun,
  Monitor,
  ChevronUp,
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
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/layout/notification-center";

const routes = [
  { label: "Boards",   icon: Layout,     href: `/dashboard` },
  { label: "Activity", icon: Activity,   href: `/activity`  },
  { label: "Settings", icon: Settings,   href: `/settings`  },
  { label: "Billing",  icon: CreditCard, href: `/billing`   },
];

const themeOptions = [
  { value: "light",  icon: Sun,     label: "Light"  },
  { value: "dark",   icon: Moon,    label: "Dark"   },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export const Sidebar = () => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = themeOptions.find((t) => t.value === theme) ?? themeOptions[0];
  const ThemeIcon = mounted ? activeTheme.icon : Monitor;

  return (
    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-20 select-none">

      {/* == Brand Header ================================================== */}
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">

        {/* Logo + App name + quick-add */}
        <div className="flex items-center gap-3 mb-5">
          {/* Gradient logo mark with "N" lettermark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-violet-700 to-purple-800 flex items-center justify-center shadow-md shrink-0">
            <span className="text-white font-bold text-[15px] leading-none tracking-tight select-none">N</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-sidebar-foreground leading-tight tracking-tight">
              Nexus
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
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
                  "group relative flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-violet-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveTab"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary dark:bg-violet-400 rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}

                <route.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-150",
                    isActive
                      ? "text-primary dark:text-violet-300"
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
      <div className="px-3 pt-3 pb-4 border-t border-sidebar-border space-y-0.5">

        {/* Theme picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              suppressHydrationWarning
              className="w-full flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ThemeIcon suppressHydrationWarning className="h-4 w-4 shrink-0" />
              <span suppressHydrationWarning className="flex-1 text-left">
                {mounted ? activeTheme.label + " Mode" : "Theme"}
              </span>
              <ChevronUp className="h-3 w-3 opacity-40" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={4}
            className="w-44 rounded-xl p-1 shadow-lg"
          >
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  theme === value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
                {theme === value && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
    </aside>
  );
};