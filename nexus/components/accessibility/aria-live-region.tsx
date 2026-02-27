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
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Announcement {
  id:       number;
  message:  string;
  priority: "polite" | "assertive";
}

export function AriaLiveRegion() {
  const [mounted, setMounted] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    function onAnnounce(e: Event) {
      const { message, priority = "polite" } = (e as CustomEvent<{ message: string; priority?: "polite" | "assertive" }>).detail;
      const id = ++counterRef.current;
      setAnnouncements((prev) => [...prev.slice(-4), { id, message, priority }]);
      // Remove after 5s so the region doesn't accumulate stale announcements
      setTimeout(() => setAnnouncements((prev) => prev.filter((a) => a.id !== id)), 5000);
    }

    window.addEventListener("nexus:announce", onAnnounce);
    return () => window.removeEventListener("nexus:announce", onAnnounce);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Polite region — reads out after current speech finishes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "sr-only",
          // Make visible during development: toggle by adding "not-sr-only" below
        )}
      >
        {announcements.filter((a) => a.priority === "polite").map((a) => (
          <span key={a.id}>{a.message}</span>
        ))}
      </div>

      {/* Assertive region — interrupts current speech (errors / urgent messages) */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements.filter((a) => a.priority === "assertive").map((a) => (
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
