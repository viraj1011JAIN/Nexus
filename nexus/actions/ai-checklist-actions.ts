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

export { suggestChecklists } from "./ai-actions";
