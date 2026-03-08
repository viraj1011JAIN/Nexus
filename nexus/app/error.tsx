"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/** Error messages that indicate a sign-out transition, not a real crash. */
const SIGNOUT_PATTERNS = [
  "unexpected response",
  "failed to fetch",
  "chunkloaderror",
  "loading chunk",
  "next_not_found",
  "clerk",
  "load failed",
  "networkerror",
  "aborted",
] as const;

function isSignoutError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return SIGNOUT_PATTERNS.some((p) => msg.includes(p));
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sign-out transition errors: silently redirect to landing page
    // instead of showing a scary 500 page.
    if (isSignoutError(error)) {
      window.location.replace("/");
      return;
    }

    // Real errors: report to Sentry
    Sentry.captureException(error, {
      extra: { digest: error.digest },
    });
  }, [error]);

  // If this is a signout error, render nothing while the redirect happens
  if (isSignoutError(error)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-700 tracking-tight">NEXUS</h1>
        </div>

        {/* Error Illustration */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <div className="text-6xl font-bold text-slate-200">500</div>
        </div>

        {/* Message */}
        <h2 className="text-3xl font-bold text-slate-900 mb-3">
          Something Went Wrong
        </h2>
        <p className="text-slate-600 mb-8">
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
          Our team has been notified and is working on a fix.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-brand-700 hover:bg-brand-900 text-white"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button
            asChild
            variant="outline"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Link>
          </Button>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 mb-2">
              Error Details (Development Only)
            </summary>
            <div className="p-4 bg-slate-100 rounded-md text-xs">
              <p className="font-bold mb-2">{error.message}</p>
              {error.digest && (
                <p className="text-slate-600 mb-2">Digest: {error.digest}</p>
              )}
              <pre className="overflow-auto text-slate-700">
                {error.stack}
              </pre>
            </div>
          </details>
        )}

        {/* Help Text */}
        <p className="text-xs text-slate-500 mt-8">
          Error persisting? Contact support with error ID: {error.digest || "N/A"}
        </p>
      </div>
    </div>
  );
}
