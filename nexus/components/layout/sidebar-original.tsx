"use client";

import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Plus, Moon, Sun, Monitor } from "lucide-react";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Sidebar = () => {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  
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

  return (
    <div className="w-64 h-full glass-effect border-r border-border/50 flex flex-col shadow-xl shrink-0 z-20 relative backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between mb-6">
          <span className="font-bold text-2xl gradient-text tracking-tight">
            NEXUS
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Organization Switcher */}
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
                padding: "6px 8px",
                width: "100%",
                borderRadius: "8px",
                border: `1px solid rgb(var(--border))`,
                justifyContent: "space-between",
                backgroundColor: `rgb(var(--card))`,
                color: `rgb(var(--foreground))`,
                "&:hover": {
                  backgroundColor: `rgb(var(--accent))`,
                },
              },
            },
          }}
        />
      </div>
      
      {/* Navigation */}
      <div className="p-4 flex-1 space-y-2">
        {routes.map((route) => (
          <Button
            key={route.href}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-x-3 font-semibold transition-all px-4 py-6 rounded-xl group hover:scale-[1.02]",
              route.active 
                ? "bg-primary/10 text-primary shadow-sm border border-primary/20" 
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
            )}
            asChild
          >
            <Link href={route.href}>
              <route.icon 
                className={cn(
                  "h-5 w-5 transition-transform group-hover:scale-110", 
                  route.active ? "text-primary" : "group-hover:text-accent-foreground"
                )} 
              />
              {route.label}
            </Link>
          </Button>
        ))}
      </div>
      
      {/* Footer */}
      <div className="p-6 border-t border-border/50 space-y-3">
        {/* Theme Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent transition-all group"
            >
              <ThemeIcon className="h-4 w-4 mr-2 transition-transform group-hover:scale-110" />
              <span className="capitalize">{theme} Mode</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 glass-effect border-border/50"
          >
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className={cn(
                "cursor-pointer gap-2",
                theme === "light" && "bg-accent text-accent-foreground"
              )}
            >
              <Sun className="h-4 w-4" />
              <span>Light</span>
              {theme === "light" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className={cn(
                "cursor-pointer gap-2",
                theme === "dark" && "bg-accent text-accent-foreground"
              )}
            >
              <Moon className="h-4 w-4" />
              <span>Dark</span>
              {theme === "dark" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className={cn(
                "cursor-pointer gap-2",
                theme === "system" && "bg-accent text-accent-foreground"
              )}
            >
              <Monitor className="h-4 w-4" />
              <span>System</span>
              {theme === "system" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* User Button */}
        <div className="flex items-center justify-center pt-2">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-10 w-10 ring-2 ring-border hover:ring-primary transition-all",
                userButtonPopoverCard: "shadow-xl glass-effect border-border/50",
              },
            }}
            afterSignOutUrl="/"
          />
        </div>
      </div>
    </div>
  );
};