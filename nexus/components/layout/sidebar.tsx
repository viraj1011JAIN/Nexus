"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Plus, Moon, Sun, Monitor } from "lucide-react";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
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
    { label: "Boards", icon: Layout, href: `/dashboard`, active: pathname === "/dashboard" },
    { label: "Activity", icon: Activity, href: `/activity`, active: pathname === "/activity" },
    { label: "Settings", icon: Settings, href: `/settings`, active: pathname === "/settings" },
    { label: "Billing", icon: CreditCard, href: `/billing`, active: pathname === "/billing" },
  ];

  const themeIcon = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }[theme];

  const ThemeIcon = themeIcon;

  const themeLabel = {
    light: "Light Mode",
    dark: "Dark Mode",
    system: "System Mode",
  }[theme];

  return (
    <div className="w-70 h-full bg-white dark:bg-[#1A1F2E] border-r border-[#E5E7EB] dark:border-[#252B3A] flex flex-col shadow-sm shrink-0 z-20">
      {/* Header - Brand Section */}
      <div className="px-8 pt-8 pb-8 border-b border-[#E5E7EB] dark:border-[#252B3A]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
              <div className="w-4 h-4 rounded bg-white/30 backdrop-blur-sm" />
            </div>
            <span className="font-bold text-2xl tracking-tight bg-linear-to-br from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
              NEXUS
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#64748B] dark:text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A] rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Organization Selector */}
        <div className="mt-6">
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
                  padding: "12px",
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  justifyContent: "space-between",
                  backgroundColor: "#F9FAFB",
                  color: "#0F172A",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 200ms ease",
                  "&:hover": {
                    backgroundColor: "#F3F4F6",
                    borderColor: "#7C3AED",
                    transform: "translateY(-1px)",
                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.15)",
                  },
                },
                organizationSwitcherTriggerIcon: {
                  width: "32px",
                  height: "32px",
                  border: "2px solid #7C3AED",
                },
              },
            }}
          />
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 px-3 pt-8 pb-6 space-y-1">
        {routes.map((route, index) => (
          <motion.div
            key={route.href}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <Link
              href={route.href}
              className={cn(
                "group relative flex items-center gap-3 h-11 px-4 rounded-lg font-medium text-[15px] transition-all duration-200",
                route.active
                  ? "bg-linear-to-r from-[#F5F3FF] to-transparent dark:from-[#2E1A2E] text-[#0F172A] dark:text-[#F1F5F9] font-semibold"
                  : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A] hover:text-[#374151] dark:hover:text-[#F1F5F9]"
              )}
            >
              {route.active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-0.75 bg-[#7C3AED] rounded-r"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <route.icon
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  route.active
                    ? "text-[#7C3AED]"
                    : "text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#7C3AED]"
                )}
              />
              <span>{route.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Footer - Theme Toggle + User */}
      <div className="px-3 py-6 border-t border-[#E5E7EB] dark:border-[#252B3A] space-y-3">
        {/* Theme Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              suppressHydrationWarning
              className="w-full flex items-center justify-start gap-3 h-11 px-4 rounded-lg text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A] hover:text-[#374151] dark:hover:text-[#F1F5F9] transition-all duration-200 font-medium text-[15px]"
            >
              {mounted && <ThemeIcon className="h-4 w-4" />}
              <span>{mounted ? themeLabel : 'Theme'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-white dark:bg-[#1A1F2E] border-[#E5E7EB] dark:border-[#252B3A] rounded-xl p-1"
          >
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className={cn(
                "cursor-pointer gap-2 rounded-lg px-3 py-2 text-[14px] font-medium",
                theme === "light"
                  ? "bg-[#F5F3FF] dark:bg-[#2E1A2E] text-[#7C3AED]"
                  : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A]"
              )}
            >
              <Sun className="h-4 w-4" />
              <span>Light</span>
              {theme === "light" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className={cn(
                "cursor-pointer gap-2 rounded-lg px-3 py-2 text-[14px] font-medium",
                theme === "dark"
                  ? "bg-[#F5F3FF] dark:bg-[#2E1A2E] text-[#7C3AED]"
                  : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A]"
              )}
            >
              <Moon className="h-4 w-4" />
              <span>Dark</span>
              {theme === "dark" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className={cn(
                "cursor-pointer gap-2 rounded-lg px-3 py-2 text-[14px] font-medium",
                theme === "system"
                  ? "bg-[#F5F3FF] dark:bg-[#2E1A2E] text-[#7C3AED]"
                  : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A]"
              )}
            >
              <Monitor className="h-4 w-4" />
              <span>System</span>
              {theme === "system" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile + Settings */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: {
                    width: "36px",
                    height: "36px",
                    border: "2px solid #7C3AED",
                  },
                },
              }}
            />
          </div>
          <NotificationCenter />
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 text-[#64748B] dark:text-[#94A3B8] hover:text-[#7C3AED] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A] rounded-lg transition-colors"
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
