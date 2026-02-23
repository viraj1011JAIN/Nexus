/**
 * Single source of truth for the Priority enum values.
 * Kept in a plain lib file (not "use server") so it can be safely exported
 * and imported by both server actions and client components without triggering
 * Next.js's "use server files may only export async functions" restriction.
 */
export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type PriorityValue = (typeof PRIORITY_VALUES)[number];
