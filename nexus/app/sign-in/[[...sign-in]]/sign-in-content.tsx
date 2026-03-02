"use client";

/**
 * SignInContent — pure client component.
 *
 * This file exists as a separate module so that the parent page.tsx can import
 * it with `next/dynamic` and `ssr: false`.  That completely eliminates the
 * possibility of a React hydration mismatch: the server renders only the
 * static dark-background shell (defined in page.tsx), while this component
 * is mounted exclusively on the client — no HTML to reconcile, no mismatch.
 *
 * Why ssr: false is the right call here:
 *  - The canvas particle animation calls Math.random() and window.devicePixelRatio
 *    at render time.  Both values differ between server and client.
 *  - The `mounted` opacity transition means the very first client frame differs
 *    from the server HTML unless handled very carefully.
 *  - Clerk's <SignIn> embeds iframes and web-component shims that are inherently
 *    client-only; SSR-ing the wrapper adds the risk without the benefit.
 */

import { SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_ORG_ID } from "@/hooks/use-demo-mode";
import { useState, useEffect, useRef } from "react";
import { Shield, Zap, Users, BarChart3 } from "lucide-react";

export default function SignInContent() {
  const router = useRouter();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Trigger entrance animation after mount
  useEffect(() => {
    // rAF ensures paint is complete before transition fires
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Canvas particle network
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      r: number; o: number;
    }

    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      o: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${p.o})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleGuestDemo = async () => {
    setIsDemoLoading(true);
    try {
      sessionStorage.setItem("demo-mode", "true");
      sessionStorage.setItem("demo-start-time", Date.now().toString());
      if (
        typeof window !== "undefined" &&
        (
          window as Window & {
            analytics?: { track: (e: string, p?: Record<string, unknown>) => void };
          }
        ).analytics
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).analytics.track("Guest Demo Started", {
          timestamp: new Date().toISOString(),
          source: "sign-in-page",
        });
      }
      router.push("/dashboard");
    } catch (error) {
      console.error("Error starting demo:", error);
      setIsDemoLoading(false);
    }
  };

  const features = [
    { icon: Zap,      label: "Real-time collaboration"   },
    { icon: Shield,   label: "Enterprise-grade security" },
    { icon: Users,    label: "Multi-tenant workspaces"   },
    { icon: BarChart3, label: "Advanced analytics"       },
  ];

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0D0C14] relative overflow-hidden">
      {/* Particle canvas — client only, no SSR */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Gradient orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-purple-600/20 to-indigo-600/10 blur-[120px] animate-auth-float" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-pink-600/15 to-violet-600/10 blur-[100px] animate-auth-float-delayed" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-600/5 blur-[80px] animate-auth-pulse" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div
        className={`relative z-10 w-full max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[20px]"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">

          {/* Left — Branding + features (lg+ only) */}
          <div className="hidden lg:flex flex-col flex-1 max-w-[440px] animate-auth-slide-right">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-[48px] h-[48px] rounded-[14px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <span className="text-white font-bold text-[20px] tracking-tight">N</span>
                </div>
                <span className="text-white font-bold text-[28px] tracking-tight">NEXUS</span>
              </div>
              <h1 className="text-[40px] leading-[1.1] font-bold text-white mb-4">
                Welcome back to
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                  your workspace
                </span>
              </h1>
              <p className="text-[16px] text-slate-400 leading-relaxed">
                Pick up where you left off. Your boards, tasks, and team are waiting.
              </p>
            </div>

            <div className="space-y-4">
              {features.map((f, i) => (
                <div
                  key={f.label}
                  className="flex items-center gap-4 p-[14px] rounded-[14px] bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.07] hover:border-purple-500/20 animate-auth-fade-up [animation-fill-mode:both]"
                  style={{ animationDelay: `${200 + i * 100}ms` }}
                >
                  <div className="w-[40px] h-[40px] rounded-[10px] bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex items-center justify-center shrink-0">
                    <f.icon className="w-[20px] h-[20px] text-purple-400" />
                  </div>
                  <span className="text-[14px] text-slate-300 font-medium">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-[8px]">
                {([0, 1, 2, 3] as const).map((i) => (
                  <div
                    key={i}
                    className="w-[32px] h-[32px] rounded-full border-2 border-[#0D0C14] bg-gradient-to-br from-purple-500 to-pink-500"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
              <p className="text-[13px] text-slate-500">
                Trusted by <span className="text-slate-300 font-semibold">2,000+</span> teams worldwide
              </p>
            </div>
          </div>

          {/* Right — Auth card */}
          <div className="w-full max-w-[95vw] sm:max-w-[440px] lg:max-w-[420px]">
            {/* Mobile branding header */}
            <div className="flex lg:hidden flex-col items-center mb-6 animate-auth-fade-up">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <span className="text-white font-bold text-[16px]">N</span>
                </div>
                <span className="text-white font-bold text-[22px]">NEXUS</span>
              </div>
              <h1 className="text-[22px] sm:text-[26px] font-bold text-white text-center">
                Welcome Back
              </h1>
              <p className="text-[13px] sm:text-[14px] text-slate-400 mt-1">
                Sign in to continue to your workspace
              </p>
            </div>

            {/* Auth card */}
            <div className="relative rounded-[20px] sm:rounded-[24px] bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl p-5 sm:p-8 shadow-2xl shadow-black/40 animate-auth-scale-up">
              {/* Top border accent */}
              <div className="absolute top-0 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rounded-full" />

              <SignIn
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none w-full p-0",
                    headerTitle: "text-[18px] sm:text-[20px] font-bold text-white",
                    headerSubtitle: "text-[13px] text-slate-400",
                    socialButtonsBlockButton:
                      "bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-purple-500/30 transition-all duration-200 text-white text-[14px] min-h-[44px] rounded-[12px]",
                    socialButtonsBlockButtonText: "text-slate-200",
                    dividerLine: "bg-white/[0.08]",
                    dividerText: "text-slate-500 text-[12px]",
                    formButtonPrimary:
                      "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.98] min-h-[44px] rounded-[12px] text-[14px] font-semibold",
                    formFieldInput:
                      "bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-slate-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 text-[15px] min-h-[44px] rounded-[12px] transition-all duration-200",
                    formFieldLabel: "text-[13px] text-slate-300 font-medium",
                    footerActionLink: "text-purple-400 hover:text-purple-300 transition-colors text-[13px]",
                    footerActionText: "text-slate-500 text-[13px]",
                    identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
                    formFieldAction: "text-purple-400 hover:text-purple-300 text-[13px]",
                    alert: "bg-red-500/10 border border-red-500/20 text-red-300 rounded-[12px]",
                    alertText: "text-red-300 text-[13px]",
                  },
                }}
              />

              {/* Demo separator */}
              <div className="relative my-5 sm:my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#0D0C14]/80 backdrop-blur-sm px-3 py-1 text-slate-500 font-semibold rounded-full">
                    or try guest mode
                  </span>
                </div>
              </div>

              {/* Guest Demo button */}
              <Button
                onClick={handleGuestDemo}
                disabled={isDemoLoading}
                size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-[14px] rounded-[12px]"
              >
                {isDemoLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-[16px] h-[16px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Loading Demo...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[18px]">🎯</span>
                    <span>View Demo (No Signup Required)</span>
                  </div>
                )}
              </Button>

              {/* Demo info banner */}
              <div className="mt-3 sm:mt-4 p-3 bg-amber-500/[0.08] border border-amber-500/[0.15] rounded-[12px]">
                <p className="text-[11px] sm:text-[12px] text-amber-300/80 text-center leading-relaxed">
                  <strong className="font-semibold text-amber-300">Guest Mode:</strong> Explore all features with sample data.
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  Changes are not saved. Sign up to create your own workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
