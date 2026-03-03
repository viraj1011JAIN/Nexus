"use client";

/**
 * global-error.tsx — Top-level error boundary.
 *
 * Rendered OUTSIDE the Next.js layout tree, which means:
 *  - No Clerk <ClerkProvider> wrapper
 *  - No shadcn/Radix context providers
 *  - No ThemeProvider
 *
 * Rule: never import context-dependent components here.
 * Use raw HTML + inline styles only.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0d0c14 0%, #160f2e 100%)",
          color: "#fff",
          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          {/* Logo */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #7b2ff7, #06b6d4)",
              fontSize: 20,
              fontWeight: 900,
              marginBottom: 32,
            }}
          >
            N
          </div>

          {/* Error code */}
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              color: "rgba(255,255,255,0.06)",
              marginBottom: -16,
              letterSpacing: "-4px",
            }}
          >
            500
          </div>

          {/* Icon */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              fontSize: 32,
              marginBottom: 24,
            }}
          >
            ⚠
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 12,
              letterSpacing: "-0.5px",
            }}
          >
            Something went wrong
          </h1>

          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
            We encountered an unexpected error. Your data is safe.
          </p>

          {error.digest && (
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginBottom: 32, fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          {!error.digest && <div style={{ marginBottom: 40 }} />}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 24px",
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(135deg, #7b2ff7, #06b6d4)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(123,47,247,0.35)",
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: "10px 24px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
