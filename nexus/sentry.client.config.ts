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

  // Adjust this value in production, 0.1 = 10% of transactions
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay: Record user sessions to debug issues
  // 10% of sessions in production, 100% in dev
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Integrations
  integrations: [
    // Browser tracing for performance monitoring
    Sentry.browserTracingIntegration(),

    // Session Replay (see user's screen during errors)
    Sentry.replayIntegration({
      maskAllText: false, // Show actual text (disable in sensitive apps)
      blockAllMedia: false, // Show images/videos
    }),

    // Browser profiling
    Sentry.browserProfilingIntegration(),
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
