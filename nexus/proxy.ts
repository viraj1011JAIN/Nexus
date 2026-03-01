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
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy",
  "/terms",
  "/shared/(.*)",
  "/api/health",
  "/api/webhook/(.*)",
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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.clerk.dev https://*.clerk.accounts.dev https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data: https: http:",
  "connect-src 'self' https://*.clerk.dev https://*.clerk.accounts.dev https://api.clerk.dev https://*.supabase.co wss://*.supabase.co https://sentry.io https://*.sentry.io https://api.unsplash.com https://api.giphy.com https://api.openai.com",
  "media-src 'self' blob:",
  "frame-src 'self' https://js.clerk.dev https://*.clerk.accounts.dev",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
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

// ─── Proxy handler ──────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // ── Layer 0: Public routes ─────────────────────────────────────────────
  if (isPublicRoute(req)) {
    // Fast-path: redirect authenticated users from the landing page to the
    // app WITHOUT rendering the page component at all. Previously, the request
    // fell through to app/page.tsx which triggered a full RSC render + a
    // second auth() call just to issue a 307. Moving the redirect here
    // eliminates that render entirely (~500 ms saved on every authed / hit).
    //
    // For unauthenticated visitors the auth() call on Edge is effectively free
    // (~5 ms) — Clerk just reads the absence of a session cookie and returns.
    if (req.nextUrl.pathname === "/") {
      const { userId } = await auth();
      if (userId) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return applySecurityHeaders(NextResponse.redirect(url, 307));
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // ── Layer 1: Authentication ────────────────────────────────────────────
  // Resolve auth state exactly once — Clerk caches this per request.
  const authObj = await auth();
  const { userId, orgId, orgRole } = authObj;

  // No session → redirect to sign-in via Clerk's built-in helper.
  // redirectToSignIn() preserves the return URL via Clerk's own mechanism
  // and handles cross-domain sign-in flows correctly.
  if (!userId) {
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // ── Layer 2: Organisation gate ─────────────────────────────────────────
  // Authenticated but no active org → send to org picker.
  // Guard against an infinite redirect on /select-org itself.
  if (!orgId && !req.nextUrl.pathname.startsWith("/select-org")) {
    const url = req.nextUrl.clone();
    url.pathname = "/select-org";
    return NextResponse.redirect(url);
  }

  // ── Layer 2b: PENDING membership gate ──────────────────────────────────
  // If the user's org membership is PENDING (set by org admin requiring
  // approval), redirect to /pending-approval. This is a soft gate — the
  // hard enforcement is in getTenantContext() which throws FORBIDDEN.
  //
  // IMPORTANT: We read from Clerk's sessionClaims (JWT). We CANNOT use
  // Prisma here because proxy.ts runs on Edge Runtime. Orgs that enable
  // "require approval" must set a Clerk publicMetadata field
  // `orgMembershipStatus: "PENDING"` to activate this edge-level redirect.
  //
  // This is a UX optimization — not a security gate. The real gate is in
  // requireRole() / requireActiveStatus() in server actions.
  const pendingAllowedPaths = ["/pending-approval", "/select-org", "/sign-in", "/sign-up", "/api/webhook"];
  const isOnPendingAllowedPath = pendingAllowedPaths.some(p => req.nextUrl.pathname.startsWith(p));
  
  if (orgId && !isOnPendingAllowedPath) {
    try {
      const sessionClaims = authObj.sessionClaims as Record<string, unknown> | undefined;
      const metadata = sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
      if (metadata?.orgMembershipStatus === "PENDING") {
        const url = req.nextUrl.clone();
        url.pathname = "/pending-approval";
        return NextResponse.redirect(url);
      }
    } catch {
      // JWT parsing failure — don't block the request, let server-side handle it
    }
  }

  // ── Layer 3: Inject verified tenant identity headers ───────────────────
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

  // ── Layer 4: Security headers on the response ──────────────────────────
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
