import * as Sentry from "@sentry/nextjs";
import { auth } from "@clerk/nextjs/server";

/**
 * Sentry-Enhanced Server Action Wrapper
 * 
 * Wraps server actions with automatic error tracking and user context.
 * 
 * **Benefits:**
 * - Captures errors with full stack traces
 * - Adds user context from Clerk
 * - Tracks performance metrics
 * - Breadcrumb trail of actions
 * 
 * **Senior Pattern:**
 * Instead of try-catch in every action, wrap once and get monitoring everywhere.
 * 
 * @example
 * ```typescript
 * export const updateCard = withSentry(
 *   "updateCard",
 *   async (data: UpdateCardInput) => {
 *     const card = await db.card.update({
 *       where: { id: data.id },
 *       data: { title: data.title },
 *     });
 *     return { data: card };
 *   }
 * );
 * 
 * // If an error occurs, Sentry automatically captures:
 * // - Action name ("updateCard")
 * // - User ID and email
 * // - Error stack trace
 * // - Performance timing
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSentry<TInput extends any[], TOutput>(
  actionName: string,
  action: (...args: TInput) => Promise<TOutput>
) {
  return async (...args: TInput): Promise<TOutput> => {
    // Start Sentry span (modern API)
    return await Sentry.startSpan(
      {
        op: "server.action",
        name: actionName,
      },
      async () => {
        try {
          // Get user context
          const { userId, orgId } = await auth();

          // Set user context in Sentry
          if (userId) {
            Sentry.setUser({
              id: userId,
              ...(orgId && { organization: orgId }),
            });
          }

          // Add breadcrumb
          Sentry.addBreadcrumb({
            category: "server.action",
            message: `Executing ${actionName}`,
            level: "info",
            data: {
              actionName,
              timestamp: new Date().toISOString(),
            },
          });

          // Execute action
          const result = await action(...args);

          return result;
        } catch (error) {
          // Capture error in Sentry
          Sentry.captureException(error, {
            tags: {
              actionName,
              serverAction: true,
            },
            contexts: {
              action: {
                name: actionName,
                args: JSON.stringify(args).slice(0, 1000), // Limit size
              },
            },
          });

          // Re-throw to maintain original behavior
          throw error;
        }
      }
    );
  };
}

/**
 * Add custom breadcrumb to Sentry
 * 
 * Use this to track user actions for debugging context.
 * 
 * @example
 * ```typescript
 * addSentryBreadcrumb("user_clicked_button", {
 *   buttonId: "create-card",
 *   boardId: "board-123",
 * });
 * ```
 */
export function addSentryBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    level: "info",
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Manually capture an exception
 * 
 * Use this for expected errors you want to track but not crash on.
 * 
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureSentryException(error, {
 *     level: "warning",
 *     tags: { operation: "riskyOperation" },
 *   });
 *   
 *   // Show user-friendly error
 *   return { error: "Operation failed, please try again" };
 * }
 * ```
 */
export function captureSentryException(
  error: unknown,
  options?: {
    level?: "fatal" | "error" | "warning" | "info" | "debug";
    tags?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: Record<string, any>;
  }
) {
  Sentry.captureException(error, {
    level: options?.level || "error",
    tags: options?.tags,
    extra: options?.extra,
  });
}
