"use client";

import { useEffect } from "react";

/**
 * Catches the "An unexpected response was received from the server" runtime
 * error that Next.js App Router throws when an RSC navigation fetch fails.
 *
 * Root cause: Clerk sign-out invalidates the session cookie, then triggers a
 * soft navigation (RSC fetch).  The server responds differently (redirects,
 * changed layout, etc.) and the RSC stream parser can't decode it → unhandled
 * error bubbles to the console as a Runtime Error.
 *
 * Fix: listen for unhandled promise rejections containing the known error
 * message and silently hard-redirect to the landing page instead.  A hard
 * navigation (window.location) fetches the full HTML document — no RSC
 * parsing, no mismatch, no error visible to the user.
 */
export function NavigationErrorGuard() {
  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      const msg =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "";

      if (msg.includes("unexpected response")) {
        // Prevent the error from appearing in the console / error overlay
        event.preventDefault();
        // Hard navigate — full page load avoids RSC mismatch entirely
        window.location.replace("/");
      }
    }

    window.addEventListener("unhandledrejection", handleRejection);
    return () =>
      window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
