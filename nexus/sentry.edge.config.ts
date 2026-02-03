import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge Runtime Configuration
 * 
 * For Middleware and Edge API Routes
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  environment: process.env.NODE_ENV,

  debug: process.env.NODE_ENV === "development",

  // Minimal integrations for edge runtime
  integrations: [],

  beforeSend(event, hint) {
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry Event (edge, dev mode, not sent):", event);
      return null;
    }

    return event;
  },
});
