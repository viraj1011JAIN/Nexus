"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Production-Grade Error Boundary
 * 
 * Prevents the entire app from crashing when a component fails.
 * Automatically reports errors to Sentry with full context.
 * 
 * **Senior Engineer Pattern:**
 * Wrap critical components (RichTextEditor, LabelManager, CardModal)
 * so that if TipTap crashes or a server action fails catastrophically,
 * users see a friendly error message instead of a white screen.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={
 *     <div className="p-4 text-center">
 *       <p>Unable to load editor</p>
 *       <button onClick={() => window.location.reload()}>Reload</button>
 *     </div>
 *   }
 *   onError={(error) => {
 *     toast.error("Editor crashed. Our team has been notified.");
 *   }}
 * >
 *   <RichTextEditor {...props} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so next render shows fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Report to Sentry with full context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
      },
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-100 p-8 bg-red-50 border-2 border-red-200 rounded-lg">
          <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
          <h2 className="text-xl font-bold text-red-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-700 mb-6 text-center max-w-md">
            We&apos;ve been notified and are working on a fix. Try refreshing the page or contact support if the problem
            persists.
          </p>

          {/* Error details (dev mode only) */}
          {this.props.showDetails && this.state.error && (
            <details className="w-full max-w-2xl mb-6 p-4 bg-white border border-red-300 rounded">
              <summary className="cursor-pointer font-semibold text-red-900 mb-2">Error Details</summary>
              <pre className="text-xs text-red-800 overflow-auto whitespace-pre-wrap">
                <code>
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.errorInfo?.componentStack}
                </code>
              </pre>
            </details>
          )}

          {/* Reset button */}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for Error Boundary (easier to use in layouts)
 * 
 * @example
 * ```tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ErrorBoundaryWrapper>
 *           {children}
 *         </ErrorBoundaryWrapper>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === "development"}
      onError={(error) => {
        // Additional logging or analytics
        console.error("Application error:", error.message);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
