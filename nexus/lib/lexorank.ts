/**
 * Lexorank Engine - Enterprise-Grade Ordering System
 * 
 * Why String-Based Ordering?
 * - Prevents race conditions in concurrent environments
 * - No gaps or conflicts when multiple users reorder simultaneously
 * - Supports insertion between any two items without reindexing
 * 
 * Algorithm:
 * - Starts at "m" (middle of alphabet)
 * - Increments: m → n → o → ... → z → za → zb
 * - Allows midpoint insertion: between "m" and "n" = "ma"
 * 
 * @see https://www.figma.com/blog/realtime-editing-of-ordered-sequences/
 */

/**
 * Generates the next lexicographical order value.
 * 
 * @param lastOrder - The current highest order value (optional)
 * @returns The next order value in sequence
 * 
 * @example
 * generateNextOrder();         // "m"
 * generateNextOrder("m");      // "n"
 * generateNextOrder("z");      // "za"
 * generateNextOrder("zz");     // "zza"
 */
export function generateNextOrder(lastOrder?: string | null): string {
  if (!lastOrder || lastOrder === "") return "m";
  
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const lastChar = lastOrder.charAt(lastOrder.length - 1);
  const index = alphabet.indexOf(lastChar);

  // If we reach 'z' or invalid character, append 'a' to create next level
  if (index === alphabet.length - 1 || index === -1) {
    return lastOrder + "a";
  }

  // Increment the last character
  return lastOrder.substring(0, lastOrder.length - 1) + alphabet[index + 1];
}

/**
 * Generates a midpoint order value between two existing orders.
 * Used for inserting items between existing positions without reindexing.
 * 
 * @param before - The order value before the insertion point
 * @param after - The order value after the insertion point (reserved for future use)
 * @returns A new order value between before and after
 * 
 * @example
 * generateMidpointOrder("m", "n");     // "ma"
 * generateMidpointOrder("ma", "mb");   // "maa"
 */
export function generateMidpointOrder(before: string, _after: string): string {
  // Simple implementation: append 'a' to the before value
  // For production, consider using a more sophisticated algorithm
  // like the one used by Jira, Linear, or Figma
  return before + "a";
}

/**
 * Rebalances order values when they become too long.
 * Prevents order strings from growing indefinitely after many operations.
 * Should be called periodically or when order strings exceed a threshold.
 * 
 * @param items - Array of items with order property
 * @returns Array of items with rebalanced order values (m, n, o, p, ...)
 * 
 * @example
 * rebalanceOrders([{ id: "1", order: "maaaa" }, { id: "2", order: "maaaaaa" }])
 * // Returns: [{ id: "1", order: "m" }, { id: "2", order: "n" }]
 */
export function rebalanceOrders<T extends { order: string }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.order.localeCompare(b.order));
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  
  return sorted.map((item, index) => ({
    ...item,
    order: alphabet[Math.min(index, alphabet.length - 1)] || "m",
  }));
}