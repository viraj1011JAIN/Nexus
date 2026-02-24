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

  // No tracing overhead in dev
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

  // Set environment
  environment: process.env.NODE_ENV,

  // No debug console spam
  debug: false,

  // Prisma integration patches every query — skip in dev
  integrations: process.env.NODE_ENV === "production"
    ? [Sentry.prismaIntegration()]
    : [],

  // Filter out noise
  ignoreErrors: [
    // Prisma expected errors
    "NotFoundError",
    "Prisma Client validation",
    
    // Clerk webhook verification
    "Webhook signature verification failed",
  ],

  // Add custom context
  beforeSend(event, _hint) {
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
