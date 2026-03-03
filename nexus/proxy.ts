/**
 * Next.js Edge Proxy (formerly middleware.ts) — Authentication & Security
 *
 * Responsibilities:
 *  1. Clerk authentication — protect all non-public routes
 *  2. Organisation gate — redirect authenticated users without an active org
 *     to /select-org so they can pick or create one
 *  3. Inject verified tenant identity headers for downstream Server Components
 *     and API route handlers (x-tenant-id, x-user-id, x-org-role)
 *  4. Security headers on every response (CSP, X-Frame-Options, etc.)
 *
 * Public routes (no auth required):
 *   /                  Landing page
 *   /about             About / marketing page
 *   /sign-in(/*)       Clerk sign-in flow
 *   /sign-up(/*)       Clerk sign-up flow
 *   /privacy           Privacy policy
 *   /terms             Terms of service
 *   /shared(/*)        Publicly shared board links
 *   /api/health        Load-balancer / uptime probe
 *   /api/webhook/(.*)  Stripe / Clerk webhook receivers (verified by HMAC)
 *
 * Clerk v5/v6 API: clerkMiddleware + createRouteMatcher
 * Next.js 16+: file is "proxy.ts" (was "middleware.ts" in Next.js ≤15)
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Public route patterns ──────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/about",              // ← public marketing page — no auth required
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy",
  "/terms",
  "/shared/(.*)",
  "/organization/demo-org-id(.*)",
  "/manifest.json",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/api/health",
  "/api/health/(.*)",         // /api/health/shards — uses CRON_SECRET Bearer auth, not Clerk
  "/api/webhook/(.*)",
  // v1 REST API — authenticated via API key, not Clerk session.
  // The route handlers call authenticateApiKey() themselves.
  "/api/v1/(.*)",
]);

// ─── Security headers — pre-computed at module load ─────────────────────────
// CSP and other headers never change at runtime. Building the CSP string once
// here (instead of on every request) removes an array-join + 5 header.set()
// calls from the hot path for every single request.
//
// NOTE: upgrade-insecure-requests and HSTS are intentionally omitted because
// the proxy runs in both HTTP (dev) and HTTPS (prod). Add HSTS via
// next.config.ts headers() for production deployments only.

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.clerk.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data: https: http:",
  "connect-src 'self' https://*.clerk.dev https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.dev https://clerk-telemetry.com https://challenges.cloudflare.com https://*.supabase.co wss://*.supabase.co https://sentry.io https://*.sentry.io https://api.unsplash.com https://api.giphy.com https://api.openai.com",
  "media-src 'self' blob:",
  "frame-src 'self' https://js.clerk.dev https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "base-uri 'self'",
].join("; ");

// Tuple array iterated once per response — faster than individual .set() calls
// with string literals repeated across the codebase.
const SECURITY_HEADER_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy",   CSP],
  ["X-Content-Type-Options",    "nosniff"],
  ["X-Frame-Options",           "SAMEORIGIN"],
  ["Referrer-Policy",           "strict-origin-when-cross-origin"],
  ["Permissions-Policy",        "camera=(), microphone=(), geolocation=(), payment=()"],
] as const;

function applySecurityHeaders(res: NextResponse): NextResponse {
  const h = res.headers;
  for (const [key, value] of SECURITY_HEADER_ENTRIES) h.set(key, value);
  h.delete("X-Powered-By");
  return res;
}

// ─── Pre-compiled matchers ──────────────────────────────────────────────────
// Compiling these once at module load keeps them out of the per-request hot
// path. The RegExp is anchored (^) so startsWith semantics are preserved.

/** Routes where a PENDING membership user is still allowed through. */
const PENDING_ALLOWED_RE = /^\/(pending-approval|select-org|sign-in|sign-up|api\/webhook)($|\/)/;

// ─── Proxy handler ───────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // ── Layer 0: Resolve auth on EVERY route (including public) ────────────
  // This call MUST happen before any early-return so that Clerk's dev-browser
  // handshake can complete. In development mode, the first request has no
  // `__clerk_db_jwt` cookie; calling auth() here lets clerkMiddleware detect
  // "dev-browser-missing" and issue the redirect to Clerk FAPI that
  // establishes the cookie. Without this, public routes would return
  // NextResponse.next() immediately, the handshake would never fire, and
  // Clerk JS would receive "An unexpected response was received from the
  // server" on every sign-in / sign-up attempt.
  //
  // Clerk caches the resolved auth state per-request, so calling auth()
  // here and again below for protected routes adds zero extra latency.
  const authObj = await auth();

  // ── Layer 1: Public routes ─────────────────────────────────────────────
  if (isPublicRoute(req)) {
    // Fast-path: redirect authenticated users from the landing page to the
    // app WITHOUT rendering the page component at all.
    //
    // isRSCRequest is only evaluated here — the check is cheap but we avoid
    // even 3 header.get() calls on every non-root public route (e.g. /sign-in)
    // by gating it behind the pathname + userId pre-check.
    if (req.nextUrl.pathname === "/" && authObj.userId) {
      const isRSCRequest =
        req.headers.get("rsc") !== null ||
        req.headers.get("next-router-prefetch") !== null ||
        req.headers.get("next-router-state-tree") !== null;

      if (!isRSCRequest) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return applySecurityHeaders(NextResponse.redirect(url, 307));
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // ── Layer 2: Authentication ────────────────────────────────────────────
  const { userId, orgId, orgRole } = authObj;

  // No session → redirect to sign-in via Clerk's built-in helper.
  // redirectToSignIn() preserves the return URL via Clerk's own mechanism
  // and handles cross-domain sign-in flows correctly.
  if (!userId) {
    // Server Actions (identified by the `Next-Action` header) cannot handle
    // 307 redirects — fetchServerAction in Next.js throws "unexpected response"
    // if the response is not a valid action reply. Return 401 JSON instead so
    // the client can surface a "session expired" message gracefully rather than
    // crashing with a runtime overlay (e.g. on sign-out while actions are in flight).
    if (req.headers.get("next-action") !== null) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Session expired. Please sign in again." },
          { status: 401 }
        )
      );
    }

    // RSC navigation & prefetch requests — the Next.js client router uses
    // fetch() with `RSC: 1` (navigation), `Next-Router-Prefetch: 1`
    // (prefetch), or `Next-Router-State-Tree` (state-tree sync) headers and
    // expects an RSC flight payload in the response. Clerk's redirectToSignIn()
    // returns a Clerk FAPI redirect chain that the RSC protocol cannot parse,
    // causing "An unexpected response was received from the server".
    // Use a standard NextResponse.redirect instead — the Next.js client router
    // detects middleware redirects natively and performs a full client-side
    // navigation to /sign-in without errors.
    if (
      req.headers.get("rsc") !== null ||
      req.headers.get("next-router-prefetch") !== null ||
      req.headers.get("next-router-state-tree") !== null
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/sign-in";
      return applySecurityHeaders(NextResponse.redirect(url));
    }

    // API routes called via client-side fetch() (e.g. /api/boards from BoardList,
    // /api/realtime-auth from Supabase) cannot follow Clerk's FAPI redirect chain.
    // That chain is cross-origin and causes a CORS failure + unhandled promise
    // rejection in the browser. Return 401 JSON so callers can handle session
    // expiry cleanly (e.g. stop polling silently on sign-out).
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      );
    }

    // Regular full-page navigation — use Clerk's built-in redirect which
    // preserves the return URL and handles cross-domain sign-in flows.
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // ── Layer 3: Organisation gate ─────────────────────────────────────────
  // Authenticated but no active org → send to org picker.
  // Guard against an infinite redirect on /select-org itself.
  if (!orgId && !req.nextUrl.pathname.startsWith("/select-org")) {
    const url = req.nextUrl.clone();
    url.pathname = "/select-org";
    return NextResponse.redirect(url);
  }

  // ── Layer 3b: PENDING membership gate ──────────────────────────────────
  // Read from Clerk's sessionClaims (JWT) — zero extra I/O.
  // Uses pre-compiled PENDING_ALLOWED_RE instead of a 5-element .some() loop.
  if (orgId && !PENDING_ALLOWED_RE.test(req.nextUrl.pathname)) {
    const metadata = (authObj.sessionClaims?.publicMetadata) as Record<string, unknown> | undefined;
    if (metadata?.orgMembershipStatus === "PENDING") {
      const url = req.nextUrl.clone();
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }
  }

  // ── Layer 4: Inject verified tenant identity headers ───────────────────
  // These headers are set here (server-side, in the trusted proxy runtime)
  // so downstream Server Components and Route Handlers can read the tenant
  // context without calling auth() again.
  //
  // IMPORTANT: These values come from Clerk's verified JWT — they are never
  // readable or forgeable by the client. Downstream code must only trust
  // them when read from next/headers on the server, not from browser requests.
  const requestHeaders = new Headers(req.headers);
  if (userId) requestHeaders.set("x-user-id", userId);
  if (orgId) requestHeaders.set("x-tenant-id", orgId);
  if (orgRole) requestHeaders.set("x-org-role", orgRole);

  // ── Layer 5: Security headers on the response ──────────────────────────
  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
});

// ─── Matcher ────────────────────────────────────────────────────────────────
// Two-entry pattern recommended by Clerk:
//   1. All pages except Next.js internals and static file extensions
//   2. All API and tRPC routes (always run, even when path has a dot)

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
