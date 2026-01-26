"use client";

import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Sidebar = () => {
  const pathname = usePathname();
  
  const routes = [
    { label: "Boards", icon: Layout, href: `/dashboard`, active: pathname === "/dashboard" },
    { label: "Activity", icon: Activity, href: `/activity`, active: pathname === "/activity" },
    { label: "Settings", icon: Settings, href: `/settings`, active: pathname === "/settings" },
    { label: "Billing", icon: CreditCard, href: `/billing`, active: pathname === "/billing" },
  ];

  return (
    /**
     * SENIOR DIAGNOSTIC FIX:
     * We use 'relative' instead of 'fixed' so the sidebar occupies physical space
     * in the flex container. This prevents an invisible 100vw container from 
     * intercepting pointer events meant for your cards.
     */
    <div className="w-64 h-full glass-effect border-r border-white/20 flex flex-col shadow-xl shrink-0 z-20 relative backdrop-blur-xl">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <span className="font-bold text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">NEXUS</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {/* Organization Switcher for multi-tenancy */}
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/"
          afterLeaveOrganizationUrl="/"
          afterSelectOrganizationUrl="/"
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
                border: "1px solid #e2e8f0",
                justifyContent: "space-between",
                backgroundColor: "white",
                "&:hover": {
                  backgroundColor: "#f8fafc",
                },
              },
            },
          }}
        />
      </div>
      <div className="p-4 flex-1 space-y-2">
        {routes.map((route) => (
          <Button
            key={route.href}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-x-3 font-semibold transition-all px-4 py-6 rounded-xl group hover:scale-102",
              route.active 
                ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:bg-white/80 hover:shadow-sm"
            )}
            asChild
          >
            <Link href={route.href}>
              <route.icon className={cn(
                "h-5 w-5 transition-transform group-hover:scale-110", 
                route.active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {route.label}
            </Link>
          </Button>
        ))}
      </div>
      <div className="p-6 border-t border-white/10 bg-gradient-to-b from-transparent to-slate-50/50">
        <div className="flex items-center justify-center">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-10 w-10",
                userButtonPopoverCard: "shadow-xl",
              },
            }}
            afterSignOutUrl="/"
          />
        </div>
      </div>
    </div>
  );
};