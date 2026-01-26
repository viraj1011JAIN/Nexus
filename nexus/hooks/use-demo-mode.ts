/**
 * Demo Mode Hook
 * 
 * Provides utilities for guest demo functionality:
 * - Demo detection
 * - Read-only enforcement
 * - Guest session management
 */

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Type declaration for analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void;
    };
  }
}

export const DEMO_ORG_ID = "demo-org-id";
export const DEMO_USER_ID = "demo-user-id";

interface UseDemoModeReturn {
  isDemoMode: boolean;
  isReadOnly: boolean;
  demoOrgId: string;
  showDemoWarning: () => void;
}

export function useDemoMode(): UseDemoModeReturn {
  const pathname = usePathname();
  const isDemoMode = pathname?.includes(DEMO_ORG_ID) ?? false;

  useEffect(() => {
    if (isDemoMode) {
      // Set session flag for middleware
      sessionStorage.setItem("demo-mode", "true");
      
      // Track demo usage (analytics)
      if (typeof window !== "undefined" && window.analytics) {
        window.analytics.track("Demo Mode Entered", {
          pathname,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return () => {
      if (isDemoMode) {
        sessionStorage.removeItem("demo-mode");
      }
    };
  }, [isDemoMode, pathname]);

  const showDemoWarning = () => {
    // Toast notification (requires sonner)
    if (typeof window !== "undefined" && (window as any).toast) {
      (window as any).toast.info(
        "This is a demo workspace. Changes are not saved.",
        {
          duration: 3000,
          icon: "🎯",
        }
      );
    } else {
      alert("This is a demo workspace. Changes are not saved.");
    }
  };

  return {
    isDemoMode,
    isReadOnly: isDemoMode,
    demoOrgId: DEMO_ORG_ID,
    showDemoWarning,
  };
}

/**
 * Server-side demo detection
 */
export function isDemoOrganization(orgId: string | null | undefined): boolean {
  return orgId === DEMO_ORG_ID;
}

/**
 * Mutation protection for Server Actions
 */
export function assertNotDemoMode(orgId: string | null | undefined): void {
  if (isDemoOrganization(orgId)) {
    throw new Error("Demo mode is read-only. Sign up to create your own workspace.");
  }
}
