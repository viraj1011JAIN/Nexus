/**
 * Sign-up page — Server Component.
 *
 * The dynamic import with ssr:false must live in a Client Component
 * (Next.js App Router restriction).  SignUpLoader is that thin client
 * boundary; it owns the dynamic call and the loading skeleton.  All
 * interactive UI is in sign-up-content.tsx and is never SSR-ed.
 */
import SignUpLoader from "./sign-up-loader";

export default function SignUpPage() {
  return <SignUpLoader />;
}
