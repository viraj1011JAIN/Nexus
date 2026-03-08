"use client";

import { useEffect } from "react";

/**
 * Catches runtime errors that occur during Clerk sign-out.
 *
 * Root cause: sign-out invalidates the session cookie mid-navigation.
 * Next.js RSC fetches, chunk loads, and router state then fail because the
 * server returns a redirect or different layout. The RSC stream parser,
 * chunk loader, or fetch itself throws — showing a scary error overlay
 * or triggering the error.tsx boundary.
 *
 * Fix: intercept BOTH synchronous errors (window.onerror) and unhandled
 * promise rejections that match known sign-out error patterns, suppress
 * them, and hard-redirect to the landing page. A hard navigation
 * (window.location) fetches full HTML — no RSC parsing, no mismatch.
 */

/** Known error message fragments that occur during sign-out transitions. */
const SIGNOUT_ERROR_PATTERNS = [
  // Next.js RSC stream parser failures
  "unexpected response",
  "failed to fetch rsc payload",
  "failed to fetch",
  // Chunk loading failures (session-gated chunks)
  "chunkloaderror",
  "loading chunk",
  "loading css chunk",
  // Next.js router state mismatches
  "next_not_found",
  "invariant: attempted to hard navigate",
  "cannot read properties of null",
  "cannot read properties of undefined",
  // Network errors during session teardown
  "networkerror",
  "load failed",
  "aborted",
  // Clerk-specific
  "clerk",
] as const;

function isSignoutError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return SIGNOUT_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Debounce flag — prevent multiple redirects from stacking. */
let redirecting = false;

function safeRedirect() {
  if (redirecting) return;
  redirecting = true;
  window.location.replace("/");
}

export function NavigationErrorGuard() {
  useEffect(() => {
    // ── Unhandled promise rejections (async errors) ──────────────────────
    function handleRejection(event: PromiseRejectionEvent) {
      const msg =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : "";

      if (isSignoutError(msg)) {
        event.preventDefault();
        safeRedirect();
      }
    }

    // ── Synchronous runtime errors ──────────────────────────────────────
    function handleError(event: ErrorEvent) {
      const msg = event.message || (event.error instanceof Error ? event.error.message : "");
      if (isSignoutError(msg)) {
        event.preventDefault();
        safeRedirect();
      }
    }

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
      redirecting = false;
    };
  }, []);

  return null;
}
