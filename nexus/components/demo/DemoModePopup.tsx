"use client";

/**
 * DemoModePopup — timed nudge popup for demo users.
 *
 * Two variants:
 *  1. Guest (not signed in) → "Sign up to keep your workspace"
 *  2. Authenticated (signed in but exploring demo) → "Go to your workspace"
 *
 * Appears every 10 minutes, max 3 times. Has a dismiss/cancel button.
 * After the 3rd dismissal, demo freezes (handled by the store).
 */

import { X, Rocket, ArrowRight, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useDemoSession, DEMO_MAX_DISMISSALS } from "@/hooks/use-demo-session";

interface DemoModePopupProps {
  remainingDismissals: number;
}

export default function DemoModePopup({ remainingDismissals }: DemoModePopupProps) {
  const { isAuthenticated, dismissPopup, dismissCount } = useDemoSession();

  const isLastChance = remainingDismissals <= 1;
  const popupNumber = dismissCount + 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-[420px] mx-4 rounded-[20px] border border-white/[0.1] bg-[#12111a] shadow-2xl shadow-purple-900/30 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-popup-title"
      >
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />

        {/* Floating glow */}
        <div className="absolute top-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full bg-purple-600/20 blur-[60px] pointer-events-none" />

        {/* Dismiss button */}
        {!isLastChance && (
          <button
            onClick={dismissPopup}
            className="absolute top-4 right-4 w-[32px] h-[32px] rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all z-10"
            aria-label="Dismiss"
          >
            <X className="w-[16px] h-[16px]" />
          </button>
        )}

        <div className="p-6 sm:p-8">
          {/* Timer badge */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              <Clock className="w-[13px] h-[13px] text-amber-400" />
              <span className="text-[12px] font-semibold text-amber-400">
                Demo popup {popupNumber} of {DEMO_MAX_DISMISSALS}
              </span>
            </div>
          </div>

          {/* Icon */}
          <div className="w-[56px] h-[56px] rounded-[16px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/25">
            {isAuthenticated ? (
              <LogIn className="w-[26px] h-[26px] text-white" />
            ) : (
              <Rocket className="w-[26px] h-[26px] text-white" />
            )}
          </div>

          {/* Content — different for guest vs authenticated */}
          {isAuthenticated ? (
            <>
              <h2
                id="demo-popup-title"
                className="text-[20px] sm:text-[22px] font-bold text-white mb-2"
              >
                You have your own workspace!
              </h2>
              <p className="text-[14px] text-slate-400 leading-relaxed mb-6">
                You&apos;re signed in but exploring the demo. Head back to your
                real workspace to create boards, manage tasks, and collaborate
                with your team — your data is saved and synced in real time.
              </p>

              {/* CTA — go to dashboard */}
              <Link href="/dashboard" className="block">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.98] min-h-[48px] text-[15px] rounded-[12px]"
                >
                  <span className="flex items-center justify-center gap-2">
                    Go to My Workspace
                    <ArrowRight className="w-[16px] h-[16px]" />
                  </span>
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2
                id="demo-popup-title"
                className="text-[20px] sm:text-[22px] font-bold text-white mb-2"
              >
                {isLastChance
                  ? "Your demo time is almost up!"
                  : "Enjoying the demo?"}
              </h2>
              <p className="text-[14px] text-slate-400 leading-relaxed mb-6">
                {isLastChance
                  ? "This is your last chance to dismiss. After this, the demo will freeze. Sign up for free to create your own workspace with unlimited access."
                  : "Sign up for free to create your own workspace — unlimited boards, real-time collaboration, and all the features you see here. No credit card required."}
              </p>

              {/* CTA — sign up */}
              <Link href="/sign-up" className="block">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.98] min-h-[48px] text-[15px] rounded-[12px]"
                >
                  <span className="flex items-center justify-center gap-2">
                    Sign Up Free
                    <ArrowRight className="w-[16px] h-[16px]" />
                  </span>
                </Button>
              </Link>
            </>
          )}

          {/* Cancel / Dismiss text button */}
          {isLastChance ? (
            <button
              onClick={dismissPopup}
              className="w-full mt-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-300 transition-colors text-center"
            >
              Dismiss (demo will freeze after this)
            </button>
          ) : (
            <button
              onClick={dismissPopup}
              className="w-full mt-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-300 transition-colors text-center"
            >
              Not now — continue demo ({remainingDismissals - 1} reminder{remainingDismissals - 1 !== 1 ? "s" : ""} left)
            </button>
          )}

          {/* Security note */}
          <p className="text-[11px] text-slate-600 text-center mt-4">
            {isAuthenticated
              ? "Your workspace data is fully encrypted and private."
              : "Free plan includes 50 boards, 500 cards/board, and real-time updates."}
          </p>
        </div>
      </div>
    </div>
  );
}
