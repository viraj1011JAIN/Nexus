"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary caught an error", { error, errorInfo });
    
    // Here you can log to Sentry or other error tracking service
    // Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-600 mb-6 max-w-md">
            We encountered an unexpected error. Don't worry, your data is safe. 
            Please try refreshing the page.
          </p>
          <div className="flex gap-x-3">
            <Button
              onClick={() => this.setState({ hasError: false })}
              variant="outline"
            >
              Try Again
            </Button>
            <Button
              onClick={() => window.location.href = "/"}
              className="bg-brand-700 hover:bg-brand-900 text-white"
            >
              Go to Homepage
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-8 text-left max-w-2xl w-full">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                Error Details (Development Only)
              </summary>
              <pre className="mt-4 p-4 bg-slate-100 rounded-md text-xs overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
