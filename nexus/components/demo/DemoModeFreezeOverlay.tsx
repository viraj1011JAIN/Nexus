"use client";

/**
 * DemoModeFreezeOverlay — full-screen blocking overlay.
 *
 * Rendered when the user has exhausted all 3 popup dismissals (30 min).
 * The demo is frozen — no interaction allowed. User must sign up (guest)
 * or return to their real workspace (authenticated).
 */

import { Lock, ArrowRight, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useDemoSession } from "@/hooks/use-demo-session";

export default function DemoModeFreezeOverlay() {
  const { isAuthenticated, resetSession } = useDemoSession();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#07070f]/95 backdrop-blur-md">
      {/* Background glow effects */}
      <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-[480px] mx-4 rounded-[24px] border border-white/[0.08] bg-[#12111a]/90 backdrop-blur-xl shadow-2xl shadow-purple-900/20 overflow-hidden">
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-purple-500 to-indigo-500" />

        <div className="p-8 sm:p-10 text-center">
          {/* Lock icon */}
          <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-red-500/20 to-purple-600/20 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-[32px] h-[32px] text-red-400" />
          </div>

          <h2 className="text-[24px] sm:text-[28px] font-bold text-white mb-3">
            Demo Mode Expired
          </h2>

          <p className="text-[15px] text-slate-400 leading-relaxed mb-8 max-w-[360px] mx-auto">
            {isAuthenticated
              ? "Your 30-minute demo exploration has ended. Return to your workspace to continue working with full access."
              : "Your 30-minute demo has ended. Create a free account to unlock your own workspace with all features — no credit card required."}
          </p>

          {/* Features they get */}
          {!isAuthenticated && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {["Unlimited boards", "Real-time sync", "AI suggestions", "Team collaboration"].map((feat) => (
                <div
                  key={feat}
                  className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/15 rounded-full px-3 py-1"
                >
                  <Sparkles className="w-[12px] h-[12px] text-purple-400" />
                  <span className="text-[12px] text-purple-300 font-medium">
                    {feat}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Primary CTA */}
          {isAuthenticated ? (
            <Link href="/dashboard" className="block">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.98] min-h-[52px] text-[16px] rounded-[14px]"
              >
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="w-[18px] h-[18px]" />
                  Return to My Workspace
                </span>
              </Button>
            </Link>
          ) : (
            <Link href="/sign-up" className="block">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.98] min-h-[52px] text-[16px] rounded-[14px]"
              >
                <span className="flex items-center justify-center gap-2">
                  Sign Up Free
                  <ArrowRight className="w-[18px] h-[18px]" />
                </span>
              </Button>
            </Link>
          )}

          {/* Secondary CTA */}
          {isAuthenticated ? (
            <button
              onClick={resetSession}
              className="w-full mt-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Restart demo session
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="block w-full mt-3 py-2.5 text-[13px] text-slate-500 hover:text-slate-300 transition-colors text-center"
            >
              Already have an account? Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
