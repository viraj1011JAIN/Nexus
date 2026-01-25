"use client";

import Link from "next/link";
import { Layout, Settings, Activity, CreditCard, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Sidebar = () => {
  const pathname = usePathname();
  
  const routes = [
    { label: "Boards", icon: Layout, href: `/`, active: pathname === "/" },
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
    <div className="w-64 h-full bg-white border-r flex flex-col shadow-soft shrink-0 z-20 relative">
      <div className="p-6 border-b flex items-center justify-between">
        <span className="font-bold text-xl text-brand-700 tracking-tight">NEXUS</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
           <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 flex-1 space-y-1">
        {routes.map((route) => (
          <Button
            key={route.href}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-x-2 font-medium transition-all px-4 py-6",
              route.active ? "bg-brand-50 text-brand-700 hover:bg-brand-50" : "text-slate-600 hover:bg-slate-50"
            )}
            asChild
          >
            <Link href={route.href}>
              <route.icon className={cn("h-5 w-5", route.active ? "text-brand-700" : "text-slate-400")} />
              {route.label}
            </Link>
          </Button>
        ))}
      </div>
      <div className="p-4 border-t bg-slate-50">
         <div className="flex items-center gap-x-3 p-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">TU</div>
            <div className="flex flex-col truncate">
               <p className="text-xs font-bold text-slate-700">Test User</p>
               <p className="text-[10px] text-slate-500">Free Plan</p>
            </div>
         </div>
      </div>
    </div>
  );
};