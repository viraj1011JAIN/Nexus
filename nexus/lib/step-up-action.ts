/**
 * Step-Up Authentication — Server Action Factory
 * ─────────────────────────────────────────────
 * Creates Zod-validated Server Actions that require the user to have
 * recently re-verified their identity ("step-up") before proceeding.
 *
 * Problem
 * ───────
 * An authenticated session is long-lived (days / weeks).  If a user's
 * laptop is left open, anyone nearby can perform destructive operations
 * — delete a board, export all data, change billing — without entering
 * any credentials, because the browser already holds a valid Clerk session
 * cookie.
 *
 * Solution: Clerk Reverification
 * ──────────────────────────────
 * Clerk's reverification API lets a server action declare that it requires
 * a *fresh* credential check within a specified time window.  If the window
 * has expired, the action returns a Clerk-magic object instead of a normal
 * response.  The `useReverification()` hook on the client detects that
 * object and opens Clerk's built-in verification modal (biometric, TOTP,
 * email/phone OTP — whatever the user has enrolled).  Once verified, the
 * hook automatically retries the action without any extra code.
 *
 * Verification levels (mapping from Clerk docs)
 * ─────────────────────────────────────────────
 *  strict     — credentials verified within the last 10 minutes  (default)
 *  moderate   — credentials verified within the last 1 hour
 *  lax        — credentials verified within the last 24 hours
 *  strict_mfa — credentials verified within the last 10 minutes AND a
 *               second factor (TOTP, SMS OTP, passkey) was used
 *
 * Usage
 * ─────
 * @example
 * ```typescript
 * // actions/delete-board.ts
 * export const deleteBoard = createStepUpAction(DeleteBoardSchema, async (input) => {
 *   const ctx = await getTenantContext();
 *   // ... do the dangerous thing
 *   return { data: result };
 * });
 *
 * // components/DeleteBoardButton.tsx
 * "use client";
 * import { useReverification } from '@clerk/nextjs';
 * const protectedDeleteBoard = useReverification(deleteBoard);
 * await protectedDeleteBoard({ id: boardId });   // shows biometric/TOTP if needed
 * ```
 *
 * What the tests cover
 * ────────────────────
 * See __tests__/unit/step-up/step-up-action.test.ts for exhaustive coverage
 * of the gate logic (skip, fire, pass-through, TenantError mapping, Zod
 * validation errors, unknown error re-throw).
 */

import "server-only";

import { auth, reverificationError } from "@clerk/nextjs/server";
import { z } from "zod";
import { TenantError } from "@/lib/tenant-context";
import type { ActionState, FieldErrors } from "@/lib/create-safe-action";

// ── Canonical tenant-error messages (mirrors create-safe-action.ts) ───────────

const TENANT_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
};

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Re-exported so callers can reference `ActionState` without a second import.
 * (avoids awkward dual-import of create-safe-action + step-up-action)
 */
export type { ActionState };

/**
 * Verification level requirements — passed to `auth.has({ reverification })`.
 *
 * | Level      | Window  | Second factor required? |
 * |------------|---------|-------------------------|
 * | strict     | 10 min  | No                      |
 * | moderate   | 1 hour  | No                      |
 * | lax        | 24 hrs  | No                      |
 * | strict_mfa | 10 min  | Yes                     |
 */
export type StepUpLevel = "strict" | "moderate" | "lax" | "strict_mfa";

/**
 * The opaque Clerk object returned when reverification is required.
 * `useReverification()` on the client intercepts this and opens the modal.
 */
export type ClerkReverificationRequired = ReturnType<typeof reverificationError>;

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Builds a Zod-validated, step-up–protected Server Action.
 *
 * Order of execution:
 *   1. `auth.protect()` — throws UNAUTHENTICATED if not signed in
 *   2. `has({ reverification: level })` — returns the Clerk prompt object if
 *      the session is stale; client-side `useReverification` shows the modal
 *   3. Zod schema validation — returns `{ fieldErrors }` on failure
 *   4. `handler(validatedData)` — your business logic
 *   5. TenantError mapping — maps RBAC/auth errors to safe client messages
 *
 * @param schema  — Zod schema that validates the raw input
 * @param handler — Business logic; receives fully-validated, typed input
 * @param level   — Reverification level (default: 'strict' = 10 minute window)
 */
export function createStepUpAction<TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: (validatedData: TInput) => Promise<ActionState<TInput, TOutput>>,
  level: StepUpLevel = "strict",
) {
  return async (
    data: TInput,
  ): Promise<ActionState<TInput, TOutput> | ClerkReverificationRequired> => {
    // ── Gate 1: Reverification ───────────────────────────────────────────────
    // auth.protect() throws if there is no active session (implicit auth gate).
    // has() checks whether the session satisfies the reverification level.
    const { has } = await auth.protect();

    if (!has({ reverification: level })) {
      // Return the Clerk magic object — useReverification() detects this on
      // the client and shows the biometric / TOTP / OTP modal automatically.
      // On success it retries the whole action without any extra client code.
      return reverificationError(level);
    }

    // ── Gate 2: Zod schema validation ───────────────────────────────────────
    const validationResult = schema.safeParse(data);
    if (!validationResult.success) {
      return {
        fieldErrors: validationResult.error.flatten()
          .fieldErrors as FieldErrors<TInput>,
      };
    }

    // ── Gate 3: Business logic ───────────────────────────────────────────────
    try {
      return await handler(validationResult.data);
    } catch (err) {
      if (err instanceof TenantError) {
        return {
          error: TENANT_ERROR_MESSAGES[err.code] ?? "Something went wrong.",
        };
      }
      // Re-throw unexpected errors — Next.js error boundary handles them.
      throw err;
    }
  };
}

// ── Audit category constants ───────────────────────────────────────────────────

/**
 * The set of action names that require step-up authentication.
 * Used by audit logs and monitoring dashboards to flag attempted bypasses.
 */
export const STEP_UP_PROTECTED_ACTIONS = [
  "DELETE_BOARD",
  "BILLING_CHECKOUT",
  "BILLING_PORTAL",
] as const;

export type StepUpProtectedAction = (typeof STEP_UP_PROTECTED_ACTIONS)[number];
