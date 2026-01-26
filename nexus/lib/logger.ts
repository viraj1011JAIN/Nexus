/**
 * Structured Logger for Production
 * Replaces console.log with proper logging infrastructure
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    console.error(this.formatMessage("error", message, errorContext));
    
    // In production, send to error tracking service (Sentry)
    if (!this.isDevelopment && typeof window === "undefined") {
      // Server-side error tracking
      // Sentry.captureException(error, { extra: context });
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  // Specialized loggers for common patterns
  webhook(event: string, status: "processing" | "success" | "error", context?: LogContext): void {
    const level = status === "error" ? "error" : "info";
    this[level](`[WEBHOOK] ${event} - ${status}`, context);
  }

  audit(action: string, userId: string, context?: LogContext): void {
    this.info(`[AUDIT] ${action}`, { userId, ...context });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`[PERFORMANCE] ${operation} completed in ${duration}ms`, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export default Logger;
