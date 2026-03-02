import dynamic from "next/dynamic";

/**
 * Sign-up page — Server Component (no "use client").
 *
 * SignUpContent is loaded with ssr: false for the same reason as the sign-in
 * page: the canvas particle animation uses Math.random() and
 * window.devicePixelRatio — both non-deterministic on the server — which
 * makes any SSR attempt a guaranteed hydration mismatch.  With ssr: false the
 * server emits only the static shell; React mounts the full component on the
 * client with nothing to reconcile.
 */
const SignUpContent = dynamic(() => import("./sign-up-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-[#0D0C14]" aria-hidden="true" />
  ),
});

export default function SignUpPage() {
  return <SignUpContent />;
}
