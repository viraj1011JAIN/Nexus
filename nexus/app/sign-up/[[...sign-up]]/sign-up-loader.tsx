"use client";

/**
 * SignUpLoader — the required Client Component boundary for `ssr: false`.
 *
 * Mirrors the sign-in pattern: this thin Client Component holds the
 * `next/dynamic` call with `ssr: false`.  The parent page.tsx stays a
 * Server Component.  All interactive sign-up UI is in sign-up-content.tsx
 * and mounts exclusively on the client — no hydration to reconcile.
 */

import dynamic from "next/dynamic";

const SignUpContent = dynamic(() => import("./sign-up-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-[#0D0C14]" aria-hidden="true" />
  ),
});

export default function SignUpLoader() {
  return <SignUpContent />;
}
