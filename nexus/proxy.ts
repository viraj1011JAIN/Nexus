import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Demo mode configuration
const DEMO_ORG_ID = "demo-org-id";
const DEMO_MUTATION_ROUTES = [
  "/api/board/create",
  "/api/board/update",
  "/api/board/delete",
  "/api/list/create",
  "/api/list/update",
  "/api/list/delete",
  "/api/card/create",
  "/api/card/update",
  "/api/card/delete",
  "/api/stripe/checkout",
  "/api/stripe/portal",
];

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  `/organization/${DEMO_ORG_ID}(.*)`, // Allow demo org access
]);

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/board(.*)",
  "/activity(.*)",
  "/settings(.*)",
  "/billing(.*)",
]);

// Check if request is a mutation to demo organization
function isDemoMutation(req: Request): boolean {
  const url = new URL(req.url);
  
  // Check if route is a mutation endpoint
  const isMutationRoute = DEMO_MUTATION_ROUTES.some(route => 
    url.pathname.includes(route)
  );
  
  if (!isMutationRoute) return false;
  
  // Check if the request is for demo org
  const isDemoPath = url.pathname.includes(DEMO_ORG_ID);
  
  // Check body for orgId (for POST requests)
  const isPostOrPatch = req.method === "POST" || req.method === "PATCH" || req.method === "DELETE";
  
  return isDemoPath || isPostOrPatch;
}

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);
  
  // Demo mode protection: Block mutations to demo organization
  if (url.pathname.includes(DEMO_ORG_ID) && req.method !== "GET" && req.method !== "HEAD") {
    // Check if this is a mutation
    const isMutation = DEMO_MUTATION_ROUTES.some(route => url.pathname.includes(route));
    
    if (isMutation) {
      return NextResponse.json(
        { 
          error: "Demo mode is read-only",
          message: "This is a demo workspace. Changes are not saved. Sign up to create your own workspace with full access.",
          demoMode: true,
        },
        { status: 403 }
      );
    }
  }
  
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return;
  }
  
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
