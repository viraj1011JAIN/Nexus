import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Server-Side Configuration
 * 
 * Captures errors in:
 * - Server Actions
 * - API Routes
 * - Server Components
 * - Middleware
 * - Background jobs
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Integrations for Node.js
  integrations: [
    // PostgreSQL query tracking
    Sentry.prismaIntegration(),
  ],

  // Filter out noise
  ignoreErrors: [
    // Prisma expected errors
    "NotFoundError",
    "Prisma Client validation",
    
    // Clerk webhook verification
    "Webhook signature verification failed",
  ],

  // Add custom context
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.log("Sentry Event (dev mode, not sent):", event);
      return null;
    }

    // Add server metadata
    event.contexts = {
      ...event.contexts,
      runtime: {
        name: "node",
        version: process.version,
      },
    };

    return event;
  },
});
