"use client";

/**
 * SignUpContent — pure client component.
 *
 * Loaded via dynamic(() => import('./sign-up-content'), { ssr: false }) from
 * the parent page.tsx Server Component, which means Next.js never SSR-s this
 * subtree.  The server sends only a static dark shell; this component mounts
 * purely on the client — zero hydration tree to reconcile, zero mismatch risk.
 */

import { SignUp } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

export default function SignUpContent() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      o: number;
    }

    const particles: Particle[] = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.8,
      o: Math.random() * 0.4 + 0.1,
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
        ctx.fillStyle = `rgba(139, 92, 246, ${p.o})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.06 * (1 - dist / 100)})`;
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

  const benefits = [
    "Unlimited boards & cards on Pro",
    "Real-time collaboration with your team",
    "AI-powered task suggestions",
    "Advanced analytics & reporting",
  ];

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0D0C14] relative overflow-hidden">
      {/* Particle canvas — client only */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Gradient orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/10 blur-[120px] animate-auth-float" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-violet-600/15 to-pink-600/10 blur-[100px] animate-auth-float-delayed" />
      <div className="absolute top-[50%] left-[30%] w-[250px] h-[250px] rounded-full bg-gradient-to-br from-cyan-500/[0.08] to-blue-600/5 blur-[80px] animate-auth-pulse" />

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
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[20px]"
        }`}
      >
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">

          {/* Left — Branding + benefits (desktop only) */}
          <div className="hidden lg:flex flex-col flex-1 max-w-[440px] animate-auth-slide-right">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-[48px] h-[48px] rounded-[14px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <span className="text-white font-bold text-[20px] tracking-tight">N</span>
                </div>
                <span className="text-white font-bold text-[28px] tracking-tight">NEXUS</span>
              </div>
              <h1 className="text-[38px] leading-[1.1] font-bold text-white mb-4">
                Start building
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                  something great
                </span>
              </h1>
              <p className="text-[16px] text-slate-400 leading-relaxed">
                Join thousands of teams who manage their projects with NEXUS. Free to
                start, powerful enough to scale.
              </p>
            </div>

            {/* Benefits checklist */}
            <div className="space-y-3.5 mb-8">
              {benefits.map((b, i) => (
                <div
                  key={b}
                  className="flex items-center gap-3 animate-auth-fade-up"
                  style={{ animationDelay: `${300 + i * 100}ms` }}
                >
                  <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-[16px] h-[16px] text-green-400" />
                  </div>
                  <span className="text-[14px] text-slate-300">{b}</span>
                </div>
              ))}
            </div>

            {/* Testimonial card */}
            <div className="p-5 rounded-[16px] bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <p className="text-[14px] text-slate-400 italic leading-relaxed mb-3">
                &ldquo;NEXUS replaced three different tools for our team. The real-time
                collaboration is incredibly smooth.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                <div>
                  <p className="text-[13px] text-white font-medium">Sarah Chen</p>
                  <p className="text-[12px] text-slate-500">Product Lead, TechCorp</p>
                </div>
              </div>
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
                Create Your Account
              </h1>
              <p className="text-[13px] sm:text-[14px] text-slate-400 mt-1">
                Free to start — no credit card required
              </p>
            </div>

            {/* Auth card container */}
            <div className="relative rounded-[20px] sm:rounded-[24px] bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl p-5 sm:p-8 shadow-2xl shadow-black/40 animate-auth-scale-up">
              {/* Top border accent */}
              <div className="absolute top-0 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />

              <SignUp
                signInUrl="/sign-in"
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
                    footerActionLink:
                      "text-purple-400 hover:text-purple-300 transition-colors text-[13px]",
                    footerActionText: "text-slate-500 text-[13px]",
                    identityPreviewEditButton: "text-purple-400 hover:text-purple-300",
                    formFieldAction: "text-purple-400 hover:text-purple-300 text-[13px]",
                    alert: "bg-red-500/10 border border-red-500/20 text-red-300 rounded-[12px]",
                    alertText: "text-red-300 text-[13px]",
                  },
                }}
              />

              {/* Free plan note on mobile */}
              <div className="mt-4 lg:hidden p-3 bg-green-500/[0.06] border border-green-500/[0.12] rounded-[12px]">
                <p className="text-[11px] sm:text-[12px] text-green-400/80 text-center leading-relaxed">
                  ✨{" "}
                  <strong className="text-green-400">Free plan includes:</strong> 50
                  boards, 500 cards/board, real-time updates
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
