"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useAiCooldown` — Per-button cooldown timer for AI action triggers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The OpenAI integration has a server-side per-org daily counter
 * (`Organization.aiCallsToday`), but a single user can still spam an AI
 * action multiple times per second, burning through the daily quota in
 * minutes. The server-side rate limiter fires AFTER an OpenAI call has
 * already been made, so each spam click costs real money before it is
 * rejected.
 *
 * This hook adds a **client-side cooldown** — a secondary defence that
 * prevents a button from being clicked again for `cooldownMs` milliseconds
 * (default 10 s) after the first click. It is intentionally lightweight:
 * - No network calls
 * - Works independently per component instance so two different AI buttons
 *   on the same page each have their own independent cooldown
 * - Countdown display so the user sees how long to wait
 *
 * USAGE
 * -----
 * ```tsx
 * const { isOnCooldown, secondsRemaining, triggerCooldown } = useAiCooldown();
 *
 * async function handleGenerateChecklist() {
 *   triggerCooldown(); // immediately disable the button
 *   const result = await suggestChecklists(cardId, title);
 *   // handle result …
 * }
 *
 * return (
 *   <Button
 *     onClick={handleGenerateChecklist}
 *     disabled={isOnCooldown}
 *   >
 *     {isOnCooldown
 *       ? `AI cooldown (${secondsRemaining}s)`
 *       : "Generate checklist"}
 *   </Button>
 * );
 * ```
 *
 * @param cooldownMs  Duration of the cooldown in milliseconds. Default: 10 000 (10 s).
 */
export function useAiCooldown(cooldownMs = 10_000) {
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers when the component unmounts to prevent memory leaks
  // and setState calls on unmounted components.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  /**
   * Starts the cooldown. Call this immediately when the user clicks the AI button,
   * BEFORE awaiting the server action, so the button is disabled instantly.
   */
  const triggerCooldown = useCallback(() => {
    // Clear any existing timers so calling triggerCooldown a second time
    // (e.g. user somehow double-clicked before the state updated) resets
    // the cooldown cleanly.
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const totalSeconds = Math.ceil(cooldownMs / 1000);
    setIsOnCooldown(true);
    setSecondsRemaining(totalSeconds);

    // Decrement the displayed countdown every second
    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((s) => {
        const next = s - 1;
        if (next <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        return Math.max(0, next);
      });
    }, 1_000);

    // Lift the cooldown after the full duration
    cooldownTimerRef.current = setTimeout(() => {
      setIsOnCooldown(false);
      setSecondsRemaining(0);
    }, cooldownMs);
  }, [cooldownMs]);

  /**
   * Manually clears the cooldown early (e.g. if the server returns a
   * "not available" error and you want to let the user retry immediately).
   */
  const resetCooldown = useCallback(() => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsOnCooldown(false);
    setSecondsRemaining(0);
  }, []);

  return {
    /** `true` while the cooldown is active — bind to `disabled` on the button. */
    isOnCooldown,
    /** Seconds remaining in the cooldown — useful for a countdown label. */
    secondsRemaining,
    /** Call immediately when the user clicks the AI trigger. */
    triggerCooldown,
    /** Clears the cooldown early (e.g. on a definitive server error). */
    resetCooldown,
  };
}
