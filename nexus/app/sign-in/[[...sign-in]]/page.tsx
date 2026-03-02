import dynamic from "next/dynamic";

/**
 * Sign-in page — Server Component (no "use client").
 *
 * The interactive sign-in UI lives in ./sign-in-content.tsx and is loaded
 * with ssr: false.  This eliminates React hydration entirely for this route:
 *
 *  · The canvas particle network calls Math.random() + window.devicePixelRatio.
 *    Both values differ between server and browser, so any SSR attempt produces
 *    a tree that can never match the client — a guaranteed hydration mismatch.
 *
 *  · With ssr: false, Next.js skips server-rendering the subtree.  The server
 *    emits only the static dark shell below; React mounts SignInContent on the
 *    client without any pre-existing server HTML to reconcile.  A mismatch is
 *    physically impossible regardless of Turbopack cache state or deploys.
 */
const SignInContent = dynamic(() => import("./sign-in-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-[#0D0C14]" aria-hidden="true" />
  ),
});

export default function SignInPage() {
  return <SignInContent />;
}
