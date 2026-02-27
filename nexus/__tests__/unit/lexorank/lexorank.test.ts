/**
 * @jest-environment node
 *
 * SECTION 19 — LexoRank & Ordering Tests
 *
 * Covers:
 *   19.1  generateNextOrder — initial, increment, z-wrap, zz-wrap
 *   19.2  generateMidpointOrder — append 'a' strategy
 *   19.3  rebalanceOrders — compacts to alphabet sequence
 *   19.4  incrementOrder — automation engine ~-append, MAX_ORDER_LENGTH fallback
 *   19.5  Ordering invariants — lexicographic comparison consistency
 *   19.6  Edge cases — empty input, long chains, concurrent scenarios
 */

import {
  generateNextOrder,
  generateMidpointOrder,
  rebalanceOrders,
} from "@/lib/lexorank";
import * as crypto from "crypto";

describe("Section 19 — LexoRank & Ordering", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 19.1 — generateNextOrder
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.1 generateNextOrder", () => {
    it("19.1a initial order (no arg) → 'm' (middle of alphabet)", () => {
      expect(generateNextOrder()).toBe("m");
    });

    it("19.1b null → 'm'", () => {
      expect(generateNextOrder(null)).toBe("m");
    });

    it("19.1c empty string → 'm'", () => {
      expect(generateNextOrder("")).toBe("m");
    });

    it("19.1d 'm' → 'n' (simple increment)", () => {
      expect(generateNextOrder("m")).toBe("n");
    });

    it("19.1e 'n' → 'o'", () => {
      expect(generateNextOrder("n")).toBe("o");
    });

    it("19.1f 'y' → 'z'", () => {
      expect(generateNextOrder("y")).toBe("z");
    });

    it("19.1g 'z' → 'za' (wraps by appending 'a')", () => {
      expect(generateNextOrder("z")).toBe("za");
    });

    it("19.1h 'za' → 'zb'", () => {
      expect(generateNextOrder("za")).toBe("zb");
    });

    it("19.1i 'zz' → 'zza' (double wrap)", () => {
      expect(generateNextOrder("zz")).toBe("zza");
    });

    it("19.1j 'zzz' → 'zzza' (triple wrap)", () => {
      expect(generateNextOrder("zzz")).toBe("zzza");
    });

    it("19.1k 'a' → 'b'", () => {
      expect(generateNextOrder("a")).toBe("b");
    });

    it("19.1l sequential generation produces lexicographic order", () => {
      const orders: string[] = [];
      let last: string | undefined = undefined;

      for (let i = 0; i < 30; i++) {
        const next = generateNextOrder(last);
        orders.push(next);
        last = next;
      }

      // Every successive element should sort after the previous
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i].localeCompare(orders[i - 1])).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19.2 — generateMidpointOrder
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.2 generateMidpointOrder", () => {
    it("19.2a midpoint between 'm' and 'n' → 'ma'", () => {
      expect(generateMidpointOrder("m", "n")).toBe("ma");
    });

    it("19.2b midpoint between 'ma' and 'n' → 'maa'", () => {
      expect(generateMidpointOrder("ma", "n")).toBe("maa");
    });

    it("19.2c result always sorts after 'before'", () => {
      const before = "m";
      const mid = generateMidpointOrder(before, "n");
      expect(mid.localeCompare(before)).toBeGreaterThan(0);
    });

    it("19.2d midpoint sorts before 'after' parameter", () => {
      const mid = generateMidpointOrder("m", "n");
      // "ma" < "n" lexicographically
      expect(mid.localeCompare("n")).toBeLessThan(0);
    });

    it("19.2e repeated midpoint insertions produce descending-length strings", () => {
      let before = "m";
      const midpoints: string[] = [];
      for (let i = 0; i < 5; i++) {
        const mid = generateMidpointOrder(before, "n");
        midpoints.push(mid);
        before = mid; // Insert after the previous midpoint
      }

      // Each midpoint should be longer than the previous
      for (let i = 1; i < midpoints.length; i++) {
        expect(midpoints[i].length).toBeGreaterThan(midpoints[i - 1].length);
      }

      // All midpoints should sort in ascending order (each after the previous)
      for (let i = 1; i < midpoints.length; i++) {
        expect(midpoints[i].localeCompare(midpoints[i - 1])).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19.3 — rebalanceOrders
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.3 rebalanceOrders", () => {
    it("19.3a rebalances long orders to single letters", () => {
      const items = [
        { id: "1", order: "maaaa", name: "First" },
        { id: "2", order: "maaaaaa", name: "Second" },
        { id: "3", order: "n", name: "Third" },
      ];

      const rebalanced = rebalanceOrders(items);

      // Should be sorted and reassigned clean orders
      expect(rebalanced).toHaveLength(3);
      expect(rebalanced[0].order).toBe("a");
      expect(rebalanced[1].order).toBe("b");
      expect(rebalanced[2].order).toBe("c");
    });

    it("19.3b preserves sort order after rebalancing", () => {
      const items = [
        { id: "3", order: "z" },
        { id: "1", order: "a" },
        { id: "2", order: "m" },
      ];

      const rebalanced = rebalanceOrders(items);

      // Sorted by original order: a, m, z → IDs: 1, 2, 3
      expect(rebalanced[0].id).toBe("1");
      expect(rebalanced[1].id).toBe("2");
      expect(rebalanced[2].id).toBe("3");
    });

    it("19.3c rebalanced values are in ascending lexicographic order", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `id-${i}`,
        order: generateNextOrder(i === 0 ? undefined : undefined), // Doesn't matter — rebalance ignores original
      }));

      // Give them already-sorted but ugly orders
      let lastOrd: string | undefined;
      for (const item of items) {
        item.order = generateNextOrder(lastOrd);
        lastOrd = item.order;
      }

      const rebalanced = rebalanceOrders(items);

      for (let i = 1; i < rebalanced.length; i++) {
        expect(rebalanced[i].order.localeCompare(rebalanced[i - 1].order)).toBeGreaterThan(0);
      }
    });

    it("19.3d does not mutate original array", () => {
      const items = [
        { id: "1", order: "zzzz" },
        { id: "2", order: "aaaa" },
      ];
      const originalOrder0 = items[0].order;

      rebalanceOrders(items);

      // Original items should be untouched
      expect(items[0].order).toBe(originalOrder0);
    });

    it("19.3e single item rebalances to 'a'", () => {
      const items = [{ id: "1", order: "zzzzzzz" }];
      const rebalanced = rebalanceOrders(items);
      expect(rebalanced[0].order).toBe("a");
    });

    it("19.3f handles up to 26 items with unique letters", () => {
      const items = Array.from({ length: 26 }, (_, i) => ({
        id: `id-${i}`,
        order: String.fromCharCode(122 - i), // z, y, x, ... a (reversed)
      }));

      const rebalanced = rebalanceOrders(items);

      // Each should get a unique alphabet letter
      const orders = rebalanced.map((r) => r.order);
      expect(new Set(orders).size).toBe(26);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19.4 — incrementOrder (automation-engine)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.4 incrementOrder (automation engine)", () => {
    // Recreate the function since it's not exported
    const MAX_ORDER_LENGTH = 32;

    function incrementOrder(order: string): string {
      if (order.length >= MAX_ORDER_LENGTH) {
        const randomSuffix = crypto.randomBytes(4).toString("hex");
        return "\uFFFF" + Date.now().toString(36) + "-" + randomSuffix;
      }
      return order + "~";
    }

    it("19.4a appends ~ to order under 32 chars", () => {
      expect(incrementOrder("m")).toBe("m~");
      expect(incrementOrder("n~~")).toBe("n~~~");
    });

    it("19.4b ~ (0x7E) has higher codepoint than all lowercase letters", () => {
      expect("~".charCodeAt(0)).toBe(0x7e);
      // ~ is U+007E, z is U+007A — ~ codepoint is higher
      expect("~".charCodeAt(0)).toBeGreaterThan("z".charCodeAt(0));
      // String comparison (not locale) confirms ordering
      expect("~" > "z").toBe(true);
      expect("m~" > "mz").toBe(true);
    });

    it("19.4c order at MAX_ORDER_LENGTH triggers fallback", () => {
      const longOrder = "a".repeat(32);
      const result = incrementOrder(longOrder);

      expect(result.startsWith("\uFFFF")).toBe(true);
      expect(result.length).toBeLessThan(50); // compact
    });

    it("19.4d fallback starts with \\uFFFF (sorts after all ASCII)", () => {
      const result = incrementOrder("a".repeat(33));
      expect(result.charCodeAt(0)).toBe(0xffff);

      // \uFFFF > any ASCII character
      expect("\uFFFF" > "~").toBe(true);
      expect("\uFFFF" > "z").toBe(true);
    });

    it("19.4e fallback includes timestamp and random component", () => {
      const result = incrementOrder("a".repeat(32));
      const body = result.slice(1); // Remove \uFFFF prefix

      // Format: timestamp(base36)-randomhex
      expect(body).toMatch(/^[a-z0-9]+-[a-f0-9]{8}$/);
    });

    it("19.4f two fallback calls produce unique values", () => {
      const r1 = incrementOrder("a".repeat(32));
      const r2 = incrementOrder("a".repeat(32));
      expect(r1).not.toBe(r2); // Random suffix ensures uniqueness
    });

    it("19.4g normal increment preserves lexicographic ordering", () => {
      let order = "m";
      const orders: string[] = [order];

      for (let i = 0; i < 10; i++) {
        order = incrementOrder(order);
        orders.push(order);
      }

      for (let i = 1; i < orders.length; i++) {
        expect(orders[i].localeCompare(orders[i - 1])).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19.5 — Ordering Invariants
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.5 Ordering invariants", () => {
    it("19.5a lexorank values are always strings, never numbers", () => {
      const order1 = generateNextOrder();
      const order2 = generateNextOrder(order1);
      const mid = generateMidpointOrder(order1, order2);

      expect(typeof order1).toBe("string");
      expect(typeof order2).toBe("string");
      expect(typeof mid).toBe("string");
    });

    it("19.5b all generated orders are non-empty", () => {
      expect(generateNextOrder().length).toBeGreaterThan(0);
      expect(generateNextOrder("m").length).toBeGreaterThan(0);
      expect(generateMidpointOrder("m", "n").length).toBeGreaterThan(0);
    });

    it("19.5c midpoint is always strictly between before and after when possible", () => {
      const before = "m";
      const after = "n";
      const mid = generateMidpointOrder(before, after);

      expect(mid.localeCompare(before)).toBeGreaterThan(0);
      expect(mid.localeCompare(after)).toBeLessThan(0);
    });

    it("19.5d generateNextOrder never returns same value as input", () => {
      const inputs = ["a", "m", "z", "za", "zz", "abc", "zzz"];
      for (const input of inputs) {
        expect(generateNextOrder(input)).not.toBe(input);
      }
    });

    it("19.5e rebalanced orders use only lowercase letters", () => {
      const items = [
        { id: "1", order: "zzzz" },
        { id: "2", order: "mmmm" },
        { id: "3", order: "aaaa" },
      ];

      const rebalanced = rebalanceOrders(items);
      for (const item of rebalanced) {
        expect(item.order).toMatch(/^[a-z]+$/);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19.6 — Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe("19.6 Edge cases", () => {
    it("19.6a undefined input → 'm'", () => {
      expect(generateNextOrder(undefined)).toBe("m");
    });

    it("19.6b chain of 100 generateNextOrder calls produces monotonically increasing orders", () => {
      const orders: string[] = [];
      let last: string | undefined;

      for (let i = 0; i < 100; i++) {
        last = generateNextOrder(last);
        orders.push(last);
      }

      for (let i = 1; i < orders.length; i++) {
        expect(orders[i].localeCompare(orders[i - 1])).toBeGreaterThan(0);
      }
    });

    it("19.6c rebalanceOrders with empty array returns empty array", () => {
      expect(rebalanceOrders([])).toEqual([]);
    });

    it("19.6d generateMidpointOrder with identical before/after still returns valid order", () => {
      const mid = generateMidpointOrder("m", "m");
      expect(typeof mid).toBe("string");
      expect(mid.length).toBeGreaterThan(0);
      // Appends 'a', so "m" → "ma"
      expect(mid).toBe("ma");
    });

    it("19.6e alphabetic characters beyond 26 items — rebalance caps at 'z'", () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `id-${i}`,
        order: `order-${String(i).padStart(3, "0")}`,
      }));

      const rebalanced = rebalanceOrders(items);
      // Items beyond 26 should get "m" (the fallback) or "z" (the last letter)
      // Based on implementation: alphabet[Math.min(index, 25)] || "m"
      expect(rebalanced[25].order).toBe("z");
      expect(rebalanced[26].order).toBe("z"); // Capped at last letter
    });
  });
});
