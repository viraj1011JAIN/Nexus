import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes — no authentication required.
 * Everything else requires a valid Clerk session.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook/stripe(.*)", // Stripe webhooks are verified by signature, not JWT
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Allow public routes through without auth check
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Resolve auth state — cached per request by Clerk
  const { userId, orgId, orgRole } = await auth();

  // Layer 1: Authentication
  // No session at all  redirect to sign-in, preserving the original URL
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Layer 2: Organisation selection
  // Authenticated but no active organisation  redirect to org selector
  // Skip for the select-org page itself to avoid redirect loop
  if (!orgId && !req.nextUrl.pathname.startsWith("/select-org")) {
    const selectOrgUrl = new URL("/select-org", req.url);
    return NextResponse.redirect(selectOrgUrl);
  }

  // Layer 3: Inject verified tenant identity as request headers
  // Set by the middleware (trusted server-side) — never by the client.
  // Downstream Server Components and API routes can read without re-calling auth().
  const requestHeaders = new Headers(req.headers);
  if (orgId) requestHeaders.set("x-tenant-id", orgId);
  if (userId) requestHeaders.set("x-user-id", userId);
  if (orgRole) requestHeaders.set("x-org-role", orgRole);

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static (compiled assets)
     *   - _next/image  (image optimisation)
     *   - favicon.ico, robots.txt, sitemap.xml (public metadata)
     *   - Files with an extension (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot)).*)",
    "/(api|trpc)(.*)",
  ],
};
