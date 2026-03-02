"use client";

/**
 * SignInLoader — the required Client Component boundary for `ssr: false`.
 *
 * Next.js App Router forbids calling `next/dynamic` with `ssr: false`
 * inside a Server Component.  This tiny file is the Client Component that
 * holds that call.  The parent page.tsx remains a Server Component and
 * simply renders this loader.
 *
 * Result: the server emits only the static dark shell (the `loading` prop
 * below).  SignInContent — canvas, Clerk embed, demo button — mounts
 * exclusively on the client.  There is no SSR-ed HTML to reconcile, so a
 * hydration mismatch is impossible.
 */

import dynamic from "next/dynamic";

const SignInContent = dynamic(() => import("./sign-in-content"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] bg-[#0D0C14]" aria-hidden="true" />
  ),
});

export default function SignInLoader() {
  return <SignInContent />;
}
