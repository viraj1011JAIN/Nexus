"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatItem {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
  sublabel: string;
  color: string;
  glow: string;
}

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  tag: string;
  gradient: string;
  border: string;
}

interface TechItem {
  name: string;
  version: string;
  role: string;
  color: string;
  badge: string;
}

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  color: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS: StatItem[] = [
  {
    value: 57,
    suffix: "+",
    label: "API Routes",
    sublabel: "All documented, typed, and rate-limited",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.25)",
  },
  {
    value: 28,
    suffix: "+",
    label: "RBAC Permissions",
    sublabel: "Dual-gate: org roles × board roles",
    color: "#10b981",
    glow: "rgba(16,185,129,0.25)",
  },
  {
    value: 5,
    suffix: "",
    label: "Board Views",
    sublabel: "Kanban · Table · Timeline · Calendar · Analytics",
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.25)",
  },
  {
    value: 1512,
    suffix: "+",
    label: "Tests Written",
    sublabel: "Unit · Integration · E2E · A11y",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.25)",
  },
  {
    value: 99.9,
    suffix: "%",
    label: "Uptime SLA",
    sublabel: "Vercel edge network + Supabase HA",
    color: "#ec4899",
    glow: "rgba(236,72,153,0.25)",
  },
  {
    value: 50,
    suffix: "ms",
    prefix: "<",
    label: "Real-time Latency",
    sublabel: "Supabase WebSocket broadcast",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.25)",
  },
];

const FEATURES: FeatureCard[] = [
  {
    icon: "🛡️",
    title: "Zero-trust Multi-tenancy",
    description:
      "Every database query is scoped to the org from the signed Clerk JWT — never from URL params. PostgreSQL RLS enforces isolation at row level, preventing any cross-tenant leak even if application logic is bypassed.",
    tag: "Security",
    gradient: "from-purple-600/10 to-indigo-600/10",
    border: "border-purple-500/20",
  },
  {
    icon: "⚡",
    title: "Sub-50ms Real-time",
    description:
      "Supabase Realtime WebSockets broadcast board mutations — card moves, new comments, member presence — to all subscribed clients in under 50ms. Zero polling. Zero page refreshes.",
    tag: "Performance",
    gradient: "from-emerald-600/10 to-cyan-600/10",
    border: "border-emerald-500/20",
  },
  {
    icon: "🤖",
    title: "AI-Powered Workflows",
    description:
      "OpenAI GPT-4o generates card descriptions, checklist items, and project summaries. DOMPurify sanitises every AI response before render. AI content is never stored raw.",
    tag: "AI",
    gradient: "from-cyan-600/10 to-blue-600/10",
    border: "border-cyan-500/20",
  },
  {
    icon: "🔐",
    title: "Dual-Gate RBAC",
    description:
      "An org OWNER without a BoardMember row has zero board access. Access requires both gates: an active OrganizationUser record AND an explicit BoardMember row with the required role. No shortcutting through org rank.",
    tag: "Auth",
    gradient: "from-pink-600/10 to-rose-600/10",
    border: "border-pink-500/20",
  },
  {
    icon: "📊",
    title: "LexoRank Ordering",
    description:
      "Cards maintain drag order using LexoRank string-based ordering — the same algorithm Jira uses. Moving a card updates exactly ONE row regardless of how many cards exist. Auto-rebalancing prevents collisions.",
    tag: "Algorithm",
    gradient: "from-orange-600/10 to-amber-600/10",
    border: "border-orange-500/20",
  },
  {
    icon: "🔌",
    title: "Webhook Automation Engine",
    description:
      "Configure automations triggered by card events. Outbound webhooks are signed with HMAC-SHA256 and validated against an SSRF blocklist. Retry queues with exponential backoff handle transient failures.",
    tag: "Integrations",
    gradient: "from-violet-600/10 to-purple-600/10",
    border: "border-violet-500/20",
  },
  {
    icon: "💳",
    title: "Stripe Billing + Step-up Auth",
    description:
      "Stripe Checkout for Free→Pro upgrades with Clerk step-up re-authentication for destructive billing actions. Webhook signature verification on every inbound event. Keys stored as SHA-256 hashes.",
    tag: "Billing",
    gradient: "from-blue-600/10 to-indigo-600/10",
    border: "border-blue-500/20",
  },
  {
    icon: "📈",
    title: "Sprint & Analytics",
    description:
      "Full sprint lifecycle management — backlog, active sprint, burndown charts, velocity reports, and cumulative flow diagrams — rendered with Recharts 3.7 with animated transitions.",
    tag: "Analytics",
    gradient: "from-teal-600/10 to-emerald-600/10",
    border: "border-teal-500/20",
  },
];

const TECH_STACK: TechItem[] = [
  { name: "Next.js", version: "16.1.4", role: "Framework + App Router", color: "#ffffff", badge: "bg-white/10" },
  { name: "React", version: "19.2.3", role: "UI Runtime + Server Components", color: "#61dafb", badge: "bg-cyan-500/10" },
  { name: "TypeScript", version: "5.x", role: "Strict mode · 0 any · 0 ts-ignore", color: "#3178c6", badge: "bg-blue-500/10" },
  { name: "Prisma", version: "5.22+", role: "Type-safe ORM + migrations", color: "#2d3748", badge: "bg-slate-500/10" },
  { name: "Clerk", version: "6.36+", role: "Auth + multi-tenancy JWT", color: "#6c47ff", badge: "bg-purple-500/10" },
  { name: "Supabase", version: "2.91+", role: "Realtime WebSockets + Storage", color: "#3ecf8e", badge: "bg-emerald-500/10" },
  { name: "Stripe", version: "v20", role: "Payments + webhooks", color: "#635bff", badge: "bg-indigo-500/10" },
  { name: "Framer Motion", version: "12.29+", role: "Animations + gestures", color: "#ff4d6d", badge: "bg-rose-500/10" },
  { name: "Tailwind CSS", version: "v4", role: "Utility-first styling", color: "#38bdf8", badge: "bg-sky-500/10" },
  { name: "Zod", version: "4.3+", role: "Schema-first validation", color: "#f59e0b", badge: "bg-amber-500/10" },
  { name: "OpenAI SDK", version: "4.104+", role: "GPT-4o AI features", color: "#74aa9c", badge: "bg-teal-500/10" },
  { name: "Sentry", version: "10.36+", role: "Error tracking + performance", color: "#362d59", badge: "bg-violet-500/10" },
];

const TIMELINE: TimelineEvent[] = [
  {
    date: "Q1 2024",
    title: "Architecture Born",
    description:
      "Designed the dual-gate RBAC model, LexoRank ordering engine, and multi-tenant Prisma schema. Chose Clerk for JWT-native org claims.",
    color: "#a78bfa",
  },
  {
    date: "Q2 2024",
    title: "Core Engine",
    description:
      "Built createSafeAction server action wrapper, audit log pipeline, rate limiting, and the 57-route API surface. Zero TypeScript errors from day one.",
    color: "#06b6d4",
  },
  {
    date: "Q3 2024",
    title: "Real-time + AI",
    description:
      "Integrated Supabase Realtime with HMAC-signed channel isolation. Added OpenAI GPT-4o for AI descriptions, checklists, and summaries with DOMPurify sanitisation.",
    color: "#10b981",
  },
  {
    date: "Q4 2024",
    title: "Enterprise Layer",
    description:
      "Shipped Stripe billing with step-up auth, webhook delivery engine with SSRF protection, API key system (nxk_ prefix, SHA-256 stored), and custom automation rules.",
    color: "#f59e0b",
  },
  {
    date: "Q1 2025",
    title: "Test Coverage",
    description:
      "Reached 1,512+ tests across Jest unit, integration, and Playwright E2E suites. Added accessibility audit suite. CI enforces 0 regressions on merge.",
    color: "#ec4899",
  },
  {
    date: "2025 →",
    title: "Production Ready",
    description:
      "Deployed on Vercel Edge Network. 99.9% uptime SLA. Lighthouse 95+ across all pages. Sentry error tracking active. Ready for UK developer portfolio review.",
    color: "#3b82f6",
  },
];

// ─── Animated Counter ─────────────────────────────────────────────────────────

function useCounter(target: number, duration = 1800, started: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!started) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(parseFloat((eased * target).toFixed(target % 1 !== 0 ? 1 : 0)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, started]);

  return count;
}

function StatCard({ stat, index }: { stat: StatItem; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shouldReduce = useReducedMotion();
  const count = useCounter(stat.value, 2000 + index * 100, visible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={shouldReduce ? false : { opacity: 0, y: 30 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative group rounded-2xl p-6 border border-white/8 bg-white/[0.03] overflow-hidden cursor-default"
      style={{
        boxShadow: visible ? `0 0 0 1px ${stat.color}22, 0 8px 32px ${stat.glow}` : "none",
        transition: "box-shadow 0.6s ease",
      }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: stat.glow }}
      />

      <div
        className="text-5xl font-black tracking-tighter leading-none mb-2 font-display"
        style={{ color: stat.color }}
      >
        {stat.prefix && <span className="text-3xl opacity-70">{stat.prefix}</span>}
        {count.toLocaleString()}
        <span className="text-3xl opacity-80">{stat.suffix}</span>
      </div>

      <div className="font-bold text-white text-[15px] mb-1">{stat.label}</div>
      <div className="text-white/40 text-[12px] leading-snug">{stat.sublabel}</div>
    </motion.div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCardComponent({ card, index }: { card: FeatureCard; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={shouldReduce ? false : { opacity: 0, y: 24 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: (index % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative rounded-2xl p-6 border bg-gradient-to-br ${card.gradient} ${card.border} hover:border-opacity-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{card.icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">
          {card.tag}
        </span>
      </div>
      <h3 className="text-[17px] font-bold text-white mb-2 leading-snug">{card.title}</h3>
      <p className="text-[13px] text-white/55 leading-relaxed">{card.description}</p>
    </motion.div>
  );
}

// ─── Particles Canvas ─────────────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduce = useReducedMotion();
  // isMounted guards against the SSR / client hydration mismatch that arises
  // from useReducedMotion() returning null on the server and true/false on the
  // client.  We render nothing until the component mounts on the client so
  // both sides agree on the initial DOM (null), then reveal the canvas after.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted || shouldReduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0, H = 0;

    interface Particle {
      x: number; y: number; r: number;
      vx: number; vy: number;
      alpha: number; color: string;
    }

    const colors = ["#7c3aed", "#a78bfa", "#06b6d4", "#10b981", "#ec4899", "#3b82f6"];
    let particles: Particle[] = [];

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = canvas.offsetHeight;
      // 80 particles → 3 160 connection checks/frame vs 7 140 with 120.
      // Keeps the canvas smooth on mid-range mobile hardware.
      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(167,139,250,${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [shouldReduce, isMounted]);

  // Return null on server (and before client mount) so SSR output matches
  // the initial client render — prevents React hydration errors.
  if (!isMounted) return null;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  accent,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      className="text-center mb-16"
      initial={shouldReduce ? false : { opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-5 border"
        style={{
          background: `${accent}15`,
          borderColor: `${accent}30`,
          color: accent,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
        {eyebrow}
      </div>
      <h2
        className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-4 font-display"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {subtitle && (
        <p className="text-white/50 text-[16px] max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </motion.div>
  );
}

// ─── Scrolling Tech Ticker ────────────────────────────────────────────────────

function TechTicker() {
  const items = [...TECH_STACK, ...TECH_STACK];
  return (
    <div className="relative overflow-hidden py-3 border-y border-white/6">
      <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-[#0d0c14] to-transparent z-10" />
      <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-[#0d0c14] to-transparent z-10" />
      <motion.div
        className="flex gap-8 w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{ willChange: "transform" }}
      >
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-[12px] font-bold text-white/70">{t.name}</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/8">
              v{t.version.replace("+", "")}
            </span>
            <span className="text-[11px] text-white/20 ml-2">·</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AboutPage() {
  const shouldReduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const { isSignedIn } = useUser();

  const [activeSection, setActiveSection] = useState("hero");

  const NAV_SECTIONS = [
    { id: "hero",     label: "Overview"  },
    { id: "stats",    label: "Facts"     },
    { id: "features", label: "Technical" },
    { id: "stack",    label: "Stack"     },
    { id: "timeline", label: "Journey"   },
  ];

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Highlight active nav on scroll
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { threshold: 0.4 }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen bg-[#0d0c14] text-white selection:bg-purple-500/30 overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Progress bar ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 origin-left z-[200]"
        style={{ scaleX, willChange: "transform" }}
      />

      {/* ── Floating Nav ── */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-black/50 backdrop-blur-xl shadow-xl">
        {NAV_SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className="relative px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200"
            style={{ color: activeSection === id ? "#fff" : "rgba(255,255,255,0.45)" }}
          >
            {activeSection === id && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-white/10"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <Link
          href="/"
          className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white/45 hover:text-white transition-colors duration-200"
        >
          ← Home
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section
        id="hero"
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 overflow-hidden"
      >
        <ParticleCanvas />

        {/* Radial gradient backdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(123,47,247,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(6,182,212,0.08) 0%, transparent 60%)",
          }}
        />

        <motion.div
          className="relative z-10 max-w-4xl"
          initial={shouldReduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[11px] font-bold uppercase tracking-widest mb-8"
            initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Production-grade · Open-source · Portfolio
          </motion.div>

          <h1
            className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.95] mb-8"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <span className="text-white">About</span>
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #06b6d4 50%, #10b981 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              NEXUS
            </span>
          </h1>

          <p className="text-[18px] md:text-[20px] text-white/55 leading-relaxed max-w-2xl mx-auto mb-10 font-light">
            A self-hostable, multi-tenant project management platform designed to compete with Jira and Trello —
            built with principal-engineer architecture as a senior portfolio project.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => scrollTo("stats")}
              className="px-8 py-3.5 rounded-full text-[14px] font-bold text-white transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "linear-gradient(135deg, #7b2ff7, #06b6d4)",
                boxShadow: "0 8px 32px rgba(123,47,247,0.35)",
              }}
            >
              Explore the Facts
            </button>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full text-[14px] font-bold text-white/70 border border-white/15 hover:bg-white/5 hover:text-white transition-all duration-200"
            >
              View Source
            </Link>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={shouldReduce ? {} : { y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <span className="text-[10px] uppercase tracking-widest text-white/25 font-bold">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      {/* ── TECH TICKER ── */}
      <TechTicker />

      {/* ── STATS / TRUE FACTS ── */}
      <section id="stats" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="True Facts"
            title='Engineered by the <span style="background:linear-gradient(135deg,#a78bfa,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">numbers</span>'
            subtitle="Real metrics from the codebase — not marketing copy. Every number is verifiable from the repository."
            accent="#a78bfa"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {STATS.map((stat, i) => (
              <StatCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>

          {/* Zero TypeScript errors callout */}
          <motion.div
            className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-6"
            initial={shouldReduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-5xl font-black text-emerald-400 font-display shrink-0">0</div>
            <div>
              <div className="font-bold text-white text-[16px] mb-1">TypeScript Errors</div>
              <div className="text-white/40 text-[13px]">
                Strict mode enabled. Zero <code className="text-emerald-400/80">any</code>, zero{" "}
                <code className="text-emerald-400/80">@ts-ignore</code>, zero{" "}
                <code className="text-emerald-400/80">as unknown as X</code> casts across 200+ files.
              </div>
            </div>
            <div className="ml-auto shrink-0">
              <div className="px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wide">
                tsc --strict --noEmit ✓
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES / TECHNICAL ── */}
      <section id="features" className="relative py-28 px-6">
        {/* Background noise */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 30% 50%, rgba(123,47,247,0.07) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 20%, rgba(6,182,212,0.06) 0%, transparent 60%)",
          }}
        />

        <div className="max-w-6xl mx-auto relative">
          <SectionHeader
            eyebrow="Technical Deep-Dive"
            title='Built with <span style="background:linear-gradient(135deg,#ec4899,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">earned complexity</span>'
            subtitle="No shortcuts. Every architectural decision has a documented reason. The codebase reads like a textbook."
            accent="#ec4899"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((card, i) => (
              <FeatureCardComponent key={card.title} card={card} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section id="stack" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow="Technology Stack"
            title='Production-grade <span style="background:linear-gradient(135deg,#06b6d4,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">dependencies</span>'
            subtitle="Every library is pinned, justified, and kept current. No abandoned packages, no security debt."
            accent="#06b6d4"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {TECH_STACK.map((tech, i) => (
              <motion.div
                key={tech.name}
                className={`group rounded-xl p-4 border border-white/8 ${tech.badge} hover:border-white/15 transition-all duration-300 hover:-translate-y-0.5 cursor-default`}
                initial={shouldReduce ? false : { opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-bold text-[14px]" style={{ color: tech.color }}>
                    {tech.name}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono">{tech.version}</span>
                </div>
                <p className="text-[11px] text-white/40 leading-snug">{tech.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION STATEMENT ── */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(123,47,247,0.1) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={shouldReduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest text-purple-400/70 mb-8">
              Philosophy
            </div>
            <blockquote
              className="text-3xl md:text-5xl font-black leading-[1.15] tracking-tight text-white mb-8"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              "Earned complexity,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg,#a78bfa,#ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                zero shortcuts,
              </span>{" "}
              documentation depth that impresses on first read."
            </blockquote>
            <p className="text-white/40 text-[15px] max-w-xl mx-auto">
              — From the NEXUS architectural specification. Every line of code was written with a senior
              technical reviewer in mind.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── TIMELINE ── */}
      <section id="timeline" className="relative py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="The Journey"
            title='From architecture to <span style="background:linear-gradient(135deg,#f59e0b,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">production</span>'
            subtitle="How a blank repo became a production-grade platform in four quarters."
            accent="#f59e0b"
          />

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/40 via-cyan-500/30 to-transparent" />

            <div className="space-y-0">
              {TIMELINE.map((event, i) => (
                <motion.div
                  key={event.date}
                  className="relative flex gap-6 pb-10"
                  initial={shouldReduce ? false : { opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Dot */}
                  <div
                    className="shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 bg-[#0d0c14]"
                    style={{ borderColor: event.color, color: event.color }}
                  >
                    {i < TIMELINE.length - 1 ? i + 1 : "→"}
                  </div>

                  {/* Content */}
                  <div className="pt-1.5 pb-2">
                    <div
                      className="text-[11px] font-bold uppercase tracking-widest mb-1"
                      style={{ color: event.color }}
                    >
                      {event.date}
                    </div>
                    <h3 className="text-[18px] font-bold text-white mb-2">{event.title}</h3>
                    <p className="text-[13px] text-white/45 leading-relaxed">{event.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY MANIFESTO ── */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow="Security Manifesto"
            title='Security is <span style="background:linear-gradient(135deg,#10b981,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">not optional</span>'
            subtitle="Every layer enforces isolation. The NEXUS security model is documented in 18 codified rules."
            accent="#10b981"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                rule: "01",
                title: "orgId only from JWT",
                body: "Never from URL params, request body, or query strings. Period.",
                color: "#a78bfa",
              },
              {
                rule: "02",
                title: "Every query scoped",
                body: "Every Prisma query includes where: { orgId } even when the item's ID is globally unique.",
                color: "#06b6d4",
              },
              {
                rule: "03",
                title: "API keys hashed",
                body: "Keys stored as SHA-256 hashes, prefixed nxk_, never logged or returned post-creation.",
                color: "#10b981",
              },
              {
                rule: "04",
                title: "DOMPurify everywhere",
                body: "AI-generated and user-submitted HTML is sanitised before any dangerouslySetInnerHTML call.",
                color: "#f59e0b",
              },
              {
                rule: "05",
                title: "SSRF blocklist",
                body: "Outbound webhook URLs are validated against an SSRF blocklist before any HTTP call is made.",
                color: "#ec4899",
              },
              {
                rule: "06",
                title: "Rate limiting",
                body: "checkRateLimit() is called at the top of every Server Action that mutates data.",
                color: "#3b82f6",
              },
            ].map((item, i) => (
              <motion.div
                key={item.rule}
                className="flex items-start gap-5 p-5 rounded-2xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-200"
                initial={shouldReduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: (i % 2) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="text-4xl font-black font-display opacity-20 shrink-0 leading-none"
                  style={{ color: item.color }}
                >
                  {item.rule}
                </div>
                <div>
                  <div className="font-bold text-white text-[14px] mb-1">{item.title}</div>
                  <div className="text-white/40 text-[12px] leading-relaxed">{item.body}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(123,47,247,0.15) 0%, transparent 70%)",
          }}
        />

        <motion.div
          className="relative max-w-3xl mx-auto text-center"
          initial={shouldReduce ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2
            className="text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-white mb-6 font-display"
          >
            Ready to{" "}
            <span
              style={{
                background: "linear-gradient(135deg,#7b2ff7,#06b6d4)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              build with it?
            </span>
          </h2>
          <p className="text-white/50 text-[17px] mb-10 leading-relaxed">
            Self-hostable. MIT licensed. Documented for technical reviewers.
            <br />
            Everything you need to evaluate NEXUS as a production system.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="px-8 py-4 rounded-full text-[14px] font-bold text-white transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "linear-gradient(135deg,#7b2ff7,#06b6d4)",
                boxShadow: "0 8px 32px rgba(123,47,247,0.35)",
              }}
            >
              {isSignedIn ? "Open Dashboard" : "Get Started Free"}
            </Link>
            <Link
              href="/"
              className="px-8 py-4 rounded-full text-[14px] font-bold text-white/60 border border-white/15 hover:bg-white/5 hover:text-white transition-all duration-200"
            >
              ← Back to Home
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/6 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[11px]"
              style={{ background: "linear-gradient(135deg,#7b2ff7,#06b6d4)" }}
            >
              N
            </div>
            <span className="text-[13px] font-bold text-white/60">NEXUS</span>
          </div>

          <p className="text-[12px] text-white/25 text-center">
            Production-grade project management SaaS. MIT License.
            Built as a principal-engineer portfolio project targeting UK developer roles £40k+.
          </p>

          <div className="flex items-center gap-4 text-[12px] text-white/35">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <Link href="/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
            <Link href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
