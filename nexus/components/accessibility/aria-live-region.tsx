"use client";

/**
 * TASK-036 — Accessible aria-live notification region
 *
 * Place this once high up in the component tree (e.g. root layout).
 * Other components can dispatch notifications via the custom event:
 *
 *   window.dispatchEvent(
 *     new CustomEvent("nexus:announce", { detail: { message, priority: "polite" | "assertive" } })
 *   );
 *
 * Implementation notes
 * --------------------
 * We intentionally render the two empty <div> containers on both the server
 * and the client (no "mounted" guard / null-return).  This keeps the server
 * and client DOM trees structurally identical and eliminates the React
 * hydration mismatch that occurred when AriaLiveRegion returned null during
 * SSR but the browser found an existing element in that slot (e.g. injected
 * by a browser extension or a stale CDN-cached server response).
 * suppressHydrationWarning on each container suppresses harmless attribute
 * or text-content differences that can arise from browser extensions.
 */

import { useEffect, useRef, useState } from "react";

interface Announcement {
  id:       number;
  message:  string;
  priority: "polite" | "assertive";
}

export function AriaLiveRegion() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    function onAnnounce(e: Event) {
      const { message, priority = "polite" } = (
        e as CustomEvent<{ message: string; priority?: "polite" | "assertive" }>
      ).detail;
      const id = ++counterRef.current;
      setAnnouncements((prev) => [...prev.slice(-4), { id, message, priority }]);
      // Remove after 5 s so the region doesn't accumulate stale text
      setTimeout(
        () => setAnnouncements((prev) => prev.filter((a) => a.id !== id)),
        5000,
      );
    }

    window.addEventListener("nexus:announce", onAnnounce);
    return () => window.removeEventListener("nexus:announce", onAnnounce);
  }, []);

  return (
    <>
      {/* Polite region — reads out after current speech finishes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        suppressHydrationWarning
      >
        {announcements
          .filter((a) => a.priority === "polite")
          .map((a) => (
            <span key={a.id}>{a.message}</span>
          ))}
      </div>

      {/* Assertive region — interrupts current speech (errors / urgent) */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        suppressHydrationWarning
      >
        {announcements
          .filter((a) => a.priority === "assertive")
          .map((a) => (
            <span key={a.id}>{a.message}</span>
          ))}
      </div>
    </>
  );
}

/**
 * Helper to announce a message from anywhere in the app.
 *
 * Example usage:
 *   announce("Card moved to Done", "polite")
 *   announce("Error: Failed to save card", "assertive")
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("nexus:announce", { detail: { message, priority } })
  );
}
