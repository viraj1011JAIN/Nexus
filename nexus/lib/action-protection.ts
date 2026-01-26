/**
 * Server Action Protection Utilities
 * 
 * Provides middleware-style protection for Server Actions:
 * - Demo mode detection and blocking
 * - RBAC enforcement (coming soon)
 * - Rate limiting (coming soon)
 */

import { auth } from "@clerk/nextjs/server";
import { ActionState } from "@/lib/create-safe-action";

const DEMO_ORG_ID = "demo-org-id";

/**
 * Demo Mode Protection
 * 
 * Prevents mutations in demo organization.
 * Use this at the start of any Server Action that modifies data.
 * 
 * @example
 * ```ts
 * const handler = async (data: InputType): Promise<ReturnType> => {
 *   const { orgId } = await auth();
 *   
 *   // Protect demo mode
 *   const demoCheck = await protectDemoMode(orgId);
 *   if (demoCheck) return demoCheck;
 *   
 *   // Continue with mutation...
 * };
 * ```
 */
export async function protectDemoMode<T = any>(
  orgId: string | null | undefined
): Promise<ActionState<any, T> | null> {
  if (orgId === DEMO_ORG_ID) {
    return {
      error: "Demo mode is read-only. Sign up to create your own workspace with full access.",
    };
  }
  
  return null;
}

/**
 * Check if organization is demo
 */
export function isDemoOrganization(orgId: string | null | undefined): boolean {
  return orgId === DEMO_ORG_ID;
}

/**
 * Combined protection (demo + auth)
 * 
 * @example
 * ```ts
 * const handler = async (data: InputType): Promise<ReturnType> => {
 *   const protection = await protectAction();
 *   if (protection.error) return protection.error;
 *   
 *   const { orgId, userId } = protection.data;
 *   // Continue with mutation...
 * };
 * ```
 */
export async function protectAction<T = any>(): Promise<{
  data?: { orgId: string; userId: string };
  error?: ActionState<any, T>;
}> {
  const { orgId, userId } = await auth();
  
  // Check authentication
  if (!orgId || !userId) {
    return {
      error: {
        error: "Unauthorized - Please sign in",
      },
    };
  }
  
  // Check demo mode
  const demoCheck = await protectDemoMode<T>(orgId);
  if (demoCheck) {
    return { error: demoCheck };
  }
  
  return {
    data: { orgId, userId },
  };
}

/**
 * Rate limit check (placeholder for future implementation)
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number = 100
): Promise<{ allowed: boolean; remaining: number }> {
  // TODO: Implement with Upstash Redis
  return { allowed: true, remaining: limit };
}
