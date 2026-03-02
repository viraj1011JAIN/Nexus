/**
 * Sign-in page — Server Component.
 *
 * The dynamic import with ssr:false must live in a Client Component
 * (Next.js App Router restriction).  SignInLoader is that thin client
 * boundary; it owns the dynamic call and the loading skeleton.  Every
 * byte of interactive UI (canvas, Clerk, demo button) is inside
 * sign-in-content.tsx and is never SSR-ed — making a hydration
 * mismatch physically impossible regardless of cache or deploy state.
 */
import SignInLoader from "./sign-in-loader";

export default function SignInPage() {
  return <SignInLoader />;
}
