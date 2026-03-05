"use client";

/**
 * DemoModeProvider — orchestrator for demo mode timer logic.
 *
 * Wrap this around any page/layout that should be demo-gated.
 * It initialises the demo session, runs a 1-second polling interval,
 * and renders the popup or freeze overlay when conditions are met.
 *
 * Timer model:
 *   - Check elapsed time every second
 *   - At 10 min mark → show popup #1
 *   - At 20 min mark → show popup #2
 *   - At 30 min mark → show popup #3
 *   - After 3 dismissals → freeze
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  useDemoSession,
  DEMO_POPUP_INTERVAL_MS,
  DEMO_MAX_DISMISSALS,
} from "@/hooks/use-demo-session";
import DemoModePopup from "@/components/demo/DemoModePopup";
import DemoModeFreezeOverlay from "@/components/demo/DemoModeFreezeOverlay";

export default function DemoModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn } = useAuth();
  const {
    startTime,
    dismissCount,
    isFrozen,
    isPopupVisible,
    initSession,
    showPopup,
  } = useDemoSession();

  const lastPopupTriggeredRef = useRef<number>(0);

  // Initialise session on mount
  useEffect(() => {
    initSession(!!isSignedIn);
  }, [initSession, isSignedIn]);

  // Polling timer — check every second
  useEffect(() => {
    if (isFrozen || !startTime) return;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      // Which popup should trigger based on elapsed time?
      // popupIndex: 1 at 10min, 2 at 20min, 3 at 30min
      const currentPopupIndex = Math.floor(elapsed / DEMO_POPUP_INTERVAL_MS);

      // Only show popup if we haven't shown this index yet and
      // user hasn't already dismissed enough
      if (
        currentPopupIndex > lastPopupTriggeredRef.current &&
        currentPopupIndex > dismissCount &&
        dismissCount < DEMO_MAX_DISMISSALS
      ) {
        lastPopupTriggeredRef.current = currentPopupIndex;
        showPopup();
      }
    };

    // Immediate check for returning users who already have elapsed time
    tick();

    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [startTime, isFrozen, dismissCount, showPopup]);

  // Sync lastPopupTriggeredRef with current dismissCount on mount
  useEffect(() => {
    if (dismissCount > 0) {
      lastPopupTriggeredRef.current = dismissCount;
    }
  }, [dismissCount]);

  return (
    <>
      {children}

      {/* Popup layer — shown at 10/20/30 min intervals */}
      {isPopupVisible && !isFrozen && (
        <DemoModePopup
          remainingDismissals={DEMO_MAX_DISMISSALS - dismissCount}
        />
      )}

      {/* Freeze layer — after 3 dismissals */}
      {isFrozen && <DemoModeFreezeOverlay />}
    </>
  );
}
