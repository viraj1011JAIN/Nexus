/**
 * Thin re-export of the AI checklist action for use by client components.
 *
 * WHY THIS FILE EXISTS:
 *   checklists.tsx ("use client") needs to call suggestChecklists.
 *   If it imported directly from ai-actions.ts, Turbopack would have to build
 *   a Server Action HMR proxy stub ("actions/data:xxxxxxxx") for the ENTIRE
 *   ai-actions.ts module graph (openai SDK, @clerk/nextjs/server, @prisma/client).
 *   Any HMR invalidation of that graph causes the proxy stub's factory to become
 *   unavailable — "module factory is not available. It might have been deleted in
 *   an HMR update." — even though none of those packages are used client-side.
 *
 *   By importing from THIS file instead, the proxy stub covers only one export
 *   and one import edge (→ ai-actions.ts). Turbopack can regenerate this stub
 *   cheaply on HMR without the factory synchronisation problem.
 */

"use server";

import "server-only";

import { suggestChecklists as _suggestChecklists } from "./ai-actions";

/**
 * Thin async wrapper so this "use server" file satisfies the constraint that
 * only async functions may be exported from a "use server" module.
 * Re-exports are not permitted — the function must be declared here.
 *
 * WHY THIS FILE EXISTS — see module-level comment in ai-actions.ts.
 */
export async function suggestChecklists(
  input: Parameters<typeof _suggestChecklists>[0],
): Promise<Awaited<ReturnType<typeof _suggestChecklists>>> {
  return _suggestChecklists(input);
}
