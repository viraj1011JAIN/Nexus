import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Client-Side Configuration
 * 
 * Captures errors, performance metrics, and user interactions in the browser.
 * Automatically tracks:
 * - React component errors
 * - Unhandled promise rejections
 * - Console errors
 * - Network failures
 * - Performance metrics (Web Vitals)
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // No tracing overhead in dev — set to 0 so spans are never created
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // Session Replay: production only — recording in dev kills performance
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,

  // Set environment
  environment: process.env.NODE_ENV,

  // No debug noise in console
  debug: false,

  // Integrations: skip replay and profiling entirely in dev
  integrations: process.env.NODE_ENV === "production"
    ? [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          // Use safe defaults: all text masked, media blocked.
          // Add ignore/mask/block options below to selectively unmask specific
          // known-safe static UI elements if needed.
          maskAllText: true,
          blockAllMedia: true,
        }),
        Sentry.browserProfilingIntegration(),
      ]
    : [
        // Minimal set in dev — no recording, no profiling
        Sentry.browserTracingIntegration(),
      ],

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    
    // Network errors users can't control
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    
    // Clerk auth errors (expected behavior)
    "Clerk:",
    "clerk:",
  ],

  // Add user context from Clerk
  beforeSend(event, _hint) {
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry Event (dev mode, not sent):", event);
      return null;
    }

    return event;
  },
});
