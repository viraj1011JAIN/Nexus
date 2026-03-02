"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "./landing-page.css";

/* ═══════════════════════════════════════════════════════════════
   LandingPage — Client Component
   Interactive marketing page with custom cursor, canvas nebula,
   scroll reveals, parallax 3D boards, and animated counters.
   ═══════════════════════════════════════════════════════════════ */

// ── Nebula canvas renderer ──────────────────────────────────────
function initNebula(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let W = (canvas.width = window.innerWidth);
  let H = (canvas.height = window.innerHeight);
  let rafId: number;

  interface Star {
    x: number;
    y: number;
    r: number;
    a: number;
    da: number;
    dx: number;
    dy: number;
    hue: number;
  }
  interface Orb {
    x: number;
    y: number;
    r: number;
    hue: number;
    dx: number;
    dy: number;
  }

  const stars: Star[] = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.005,
      dx: (Math.random() - 0.5) * 0.15,
      dy: (Math.random() - 0.5) * 0.15,
      hue: Math.random() > 0.7 ? 280 : Math.random() > 0.5 ? 190 : 330,
    });
  }

  const orbs: Orb[] = [
    { x: W * 0.2, y: H * 0.3, r: 300, hue: 270, dx: 0.3, dy: 0.2 },
    { x: W * 0.8, y: H * 0.2, r: 250, hue: 200, dx: -0.2, dy: 0.3 },
    { x: W * 0.5, y: H * 0.8, r: 200, hue: 310, dx: 0.15, dy: -0.25 },
  ];

  function onResize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", onResize);

  function draw() {
    ctx!.clearRect(0, 0, W, H);

    // Orbs
    for (const o of orbs) {
      o.x += o.dx;
      o.y += o.dy;
      if (o.x < -o.r || o.x > W + o.r) o.dx *= -1;
      if (o.y < -o.r || o.y > H + o.r) o.dy *= -1;
      const g = ctx!.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `hsla(${o.hue},70%,55%,0.06)`);
      g.addColorStop(1, `hsla(${o.hue},70%,55%,0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx!.fill();
    }

    // Stars
    for (const s of stars) {
      s.x += s.dx;
      s.y += s.dy;
      s.a += s.da;
      if (s.a < 0.1) s.da = Math.abs(s.da);
      if (s.a > 0.9) s.da = -Math.abs(s.da);
      if (s.x < 0) s.x = W;
      if (s.x > W) s.x = 0;
      if (s.y < 0) s.y = H;
      if (s.y > H) s.y = 0;
      ctx!.beginPath();
      ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx!.fillStyle = `hsla(${s.hue},70%,80%,${s.a})`;
      ctx!.fill();
    }

    // Constellation lines
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx!.beginPath();
          ctx!.moveTo(stars[i].x, stars[i].y);
          ctx!.lineTo(stars[j].x, stars[j].y);
          ctx!.strokeStyle = `rgba(139,92,246,${0.08 * (1 - dist / 100)})`;
          ctx!.lineWidth = 0.5;
          ctx!.stroke();
        }
      }
    }

    rafId = requestAnimationFrame(draw);
  }
  draw();

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
  };
}

// ── Tech stack items ────────────────────────────────────────────
const TECH_ITEMS = [
  { name: "Next.js 16", color: "#000" },
  { name: "TypeScript", color: "#3b82f6" },
  { name: "Supabase", color: "#3ecf8e" },
  { name: "Prisma ORM", color: "#2563eb" },
  { name: "Clerk Auth", color: "#6366f1" },
  { name: "Stripe", color: "#7c3aed" },
  { name: "Tailwind CSS", color: "#38bdf8" },
  { name: "shadcn/ui", color: "#555" },
  { name: "Vercel Edge", color: "#e11d48" },
  { name: "LexoRank", color: "#f97316" },
];

// ── Component ───────────────────────────────────────────────────
export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainBoardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // ── Canvas nebula ──
  useEffect(() => {
    if (!canvasRef.current) return;
    return initNebula(canvasRef.current);
  }, []);

  // ── Custom cursor (desktop only) ──
  // Cursor elements are appended to document.body to escape
  // layout.tsx's contain-layout on #main-content, which breaks
  // position:fixed inside child components.
  const cursorDotRef = useRef<HTMLDivElement | null>(null);
  const cursorRingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Skip on touch devices
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    // Create cursor elements directly on document.body
    const dot = document.createElement("div");
    dot.id = "nexus-cursor";
    const ring = document.createElement("div");
    ring.id = "nexus-cursor-trail";
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    cursorDotRef.current = dot;
    cursorRingRef.current = ring;

    document.documentElement.classList.add("has-cursor");

    // Track mouse with zero delay on the dot,
    // smooth lerp on the trailing ring
    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;
    let rafId = 0;

    function onMove(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
      // Dot follows instantly — no transition, no RAF delay
      dot.style.left = `${mx}px`;
      dot.style.top = `${my}px`;
    }

    // Lerp loop for the trailing ring — silky 60 fps
    function lerpRing() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      rafId = requestAnimationFrame(lerpRing);
    }
    rafId = requestAnimationFrame(lerpRing);

    document.addEventListener("mousemove", onMove);

    // Hover detection — expand dot + shift color on interactive elements
    function onEnter() { dot.classList.add("hover"); }
    function onLeave() { dot.classList.remove("hover"); }

    // Use event delegation on the entire document for bullet-proof coverage
    const INTERACTIVE_SELECTOR = "a, button, [role='button'], input, textarea, select, label";
    function onOver(e: MouseEvent) {
      if ((e.target as Element)?.closest?.(INTERACTIVE_SELECTOR)) onEnter();
    }
    function onOut(e: MouseEvent) {
      if ((e.target as Element)?.closest?.(INTERACTIVE_SELECTOR)) onLeave();
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);

    // Hide cursor when mouse leaves the window
    function onLeaveWindow() {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    }
    function onEnterWindow() {
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    }
    document.addEventListener("mouseleave", onLeaveWindow);
    document.addEventListener("mouseenter", onEnterWindow);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onLeaveWindow);
      document.removeEventListener("mouseenter", onEnterWindow);
      document.documentElement.classList.remove("has-cursor");
      dot.remove();
      ring.remove();
    };
  }, []);

  // ── Parallax 3D boards ──
  useEffect(() => {
    const board = mainBoardRef.current;
    if (!board) return;

    function onMove(e: MouseEvent) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const rx = ((e.clientY - cy) / cy) * 6;
      const ry = ((e.clientX - cx) / cx) * -6;
      board!.style.transform = `translateX(-50%) rotateX(${8 + rx * 0.3}deg) rotateY(${ry * 0.3}deg)`;
    }
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // ── Scroll reveal (IntersectionObserver) ──
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reveals = root.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, []);

  // ── Draggable screenshot track ──
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    function onDown(e: MouseEvent) {
      isDown = true;
      startX = e.pageX - track!.offsetLeft;
      scrollLeft = track!.scrollLeft;
      track!.classList.add("grabbing");
    }
    function onUp() {
      isDown = false;
      track!.classList.remove("grabbing");
    }
    function onMoveTrack(e: MouseEvent) {
      if (!isDown) return;
      const x = e.pageX - track!.offsetLeft;
      track!.scrollLeft = scrollLeft - (x - startX) * 2;
    }

    track.addEventListener("mousedown", onDown);
    track.addEventListener("mouseleave", onUp);
    track.addEventListener("mouseup", onUp);
    track.addEventListener("mousemove", onMoveTrack);
    return () => {
      track.removeEventListener("mousedown", onDown);
      track.removeEventListener("mouseleave", onUp);
      track.removeEventListener("mouseup", onUp);
      track.removeEventListener("mousemove", onMoveTrack);
    };
  }, []);

  // ── Animated chart bars ──
  useEffect(() => {
    const barsEl = document.getElementById("chart-bars-landing");
    if (!barsEl) return;
    const heights = [30, 45, 35, 70, 60, 85, 100];
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const bars = barsEl.querySelectorAll<HTMLElement>(".chart-bar");
          bars.forEach((bar, i) => {
            bar.style.height = "0%";
            setTimeout(() => {
              bar.style.transition = `height 0.8s ${i * 0.1}s ease`;
              bar.style.height = `${heights[i]}%`;
            }, 300);
          });
        }
      },
      { threshold: 0.5 }
    );
    io.observe(barsEl);
    return () => io.disconnect();
  }, []);

  // ── Smooth scroll for anchor links ──
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    function onClick(e: Event) {
      const anchor = (e.target as Element).closest('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="landing-root" ref={rootRef}>

      {/* Canvas background */}
      <canvas className="nebula-canvas" ref={canvasRef} />

      {/* ─── NAV ─── */}
      <nav className="landing-nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-icon">✦</span>
          NEXUS
        </Link>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#showcase">Product</a>
          <a href="#workflow">Workflow</a>
          <Link href="/sign-in">Sign In</Link>
          <Link href="/sign-up" className="nav-cta">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="landing-hero" id="hero">
        <div className="hero-badge">
          <div className="hero-badge-dot" />
          Supabase Realtime · Now Live
        </div>

        <h1 className="hero-title">
          <span className="line1">Your team&apos;s work,</span>
          <span className="line2">beautifully connected.</span>
        </h1>

        <p className="hero-sub">
          NEXUS brings <span>drag-and-drop boards</span>, real-time
          collaboration, and enterprise analytics into one stunning workspace.
        </p>

        <div className="hero-actions">
          <Link href="/sign-up" className="btn-primary">
            <span>Start for free</span>
            <span>→</span>
          </Link>
          <a href="#showcase" className="btn-ghost">
            <span>See it in action</span>
            <span style={{ opacity: 0.5 }}>↓</span>
          </a>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <div className="stat-num">10K+</div>
            <div className="stat-label">Active Teams</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-num">99.9%</div>
            <div className="stat-label">Uptime SLA</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-num">∞</div>
            <div className="stat-label">Free Boards</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-num">&lt;50ms</div>
            <div className="stat-label">Realtime Sync</div>
          </div>
        </div>

        {/* ─── 3D BOARDS ─── */}
        <div className="boards-showcase" id="boards3d">
          {/* Left card — Kanban */}
          <div className="board-float board-left">
            <div className="mock-header">
              <div className="mock-dot" style={{ background: "#ef4444" }} />
              <div className="mock-dot" style={{ background: "#f59e0b" }} />
              <div className="mock-dot" style={{ background: "#10b981" }} />
              <div className="mock-title">PROJECT · KANBAN</div>
            </div>
            <div className="screen-kanban" style={{ height: 160 }}>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div
                    className="mock-list-dot"
                    style={{ background: "#a78bfa" }}
                  />
                  TO DO
                </div>
                <div className="screen-kanban-item">API Integration</div>
                <div className="screen-kanban-item">Design review</div>
              </div>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div
                    className="mock-list-dot"
                    style={{ background: "#06b6d4" }}
                  />
                  IN PROGRESS
                </div>
                <div className="screen-kanban-item">Auth flow</div>
              </div>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div
                    className="mock-list-dot"
                    style={{ background: "#10b981" }}
                  />
                  DONE
                </div>
                <div className="screen-kanban-item">Setup repo</div>
                <div className="screen-kanban-item">DB schema</div>
              </div>
            </div>
          </div>

          {/* Main card — Dashboard */}
          <div
            className="board-float board-main"
            ref={mainBoardRef}
          >
            <div className="mock-header">
              <div className="mock-dot" style={{ background: "#ef4444" }} />
              <div className="mock-dot" style={{ background: "#f59e0b" }} />
              <div className="mock-dot" style={{ background: "#10b981" }} />
              <div className="mock-title">NEXUS — My Boards</div>
            </div>
            <div className="mock-stats-row">
              <div className="mock-stat-chip">
                <div className="mock-stat-num">7</div>
                <div className="mock-stat-lbl">Boards</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: "#06b6d4" }}>
                  24
                </div>
                <div className="mock-stat-lbl">Cards</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: "#10b981" }}>
                  9
                </div>
                <div className="mock-stat-lbl">Lists</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: "#ec4899" }}>
                  7/7
                </div>
                <div className="mock-stat-lbl">Active</div>
              </div>
            </div>
            <div className="mock-body">
              <div className="mock-board-card c1">
                <div className="mock-board-tag">DESIGN</div>
                <span>Product Redesign</span>
              </div>
              <div className="mock-board-card c2">
                <div className="mock-board-tag">DEV</div>
                <span>API Sprint</span>
              </div>
              <div className="mock-board-card c3">
                <div className="mock-board-tag">OPS</div>
                <span>Q2 Launch</span>
              </div>
              <div className="mock-board-card c4">
                <div className="mock-board-tag">RESEARCH</div>
                <span>User Testing</span>
              </div>
              <div className="mock-board-card c5">
                <div className="mock-board-tag">NEXUS</div>
                <span>Masters</span>
              </div>
              <div className="mock-board-card c6">
                <div className="mock-board-tag">MONUMENT</div>
                <span>Born</span>
              </div>
            </div>
          </div>

          {/* Right card — Analytics */}
          <div className="board-float board-right">
            <div className="mock-header">
              <div className="mock-dot" style={{ background: "#ef4444" }} />
              <div className="mock-dot" style={{ background: "#f59e0b" }} />
              <div className="mock-dot" style={{ background: "#10b981" }} />
              <div className="mock-title">ANALYTICS</div>
            </div>
            <div className="screen-analytics" style={{ height: 160 }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "#10b981",
                  marginBottom: 8,
                }}
              >
                ● LIVE — Velocity Trend
              </div>
              <svg
                viewBox="0 0 200 60"
                className="sparkline"
                style={{ width: "100%", height: 60 }}
              >
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#10b981"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <path
                  d="M0,55 L20,52 L40,48 L60,45 L80,40 L100,32 L120,28 L140,20 L160,15 L180,8 L200,2"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <path
                  d="M0,55 L20,52 L40,48 L60,45 L80,40 L100,32 L120,28 L140,20 L160,15 L180,8 L200,2 L200,60 L0,60 Z"
                  fill="url(#lineGrad)"
                />
              </svg>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <div style={{ fontSize: "0.6rem", color: "#555" }}>
                  Completed{" "}
                  <span style={{ color: "#10b981" }}>↑ 42%</span>
                </div>
                <div style={{ fontSize: "0.6rem", color: "#555" }}>
                  Velocity{" "}
                  <span style={{ color: "#a78bfa" }}>↑ 18%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="board-glow" />
        </div>
      </section>

      {/* ─── FEATURES BENTO ─── */}
      <section className="features-section" id="features">
        <div className="features-header reveal">
          <div className="section-label">Features</div>
          <h2 className="section-title">
            Built for how
            <br />
            teams <span className="accent">actually work</span>
          </h2>
        </div>

        <div className="bento-grid">
          {/* Real-time collab */}
          <div className="bento-card b1 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
            >
              ⚡
            </div>
            <div className="bento-title">Real-time Collaboration</div>
            <div className="bento-desc">
              See teammates&apos; cursors, updates, and presence live. Powered
              by Supabase WebSocket channels with sub-50ms latency — no refresh
              ever needed.
            </div>
            <div className="live-badge">
              <div className="hero-badge-dot" /> 3 members active now
            </div>
            <div className="collab-avatars">
              <div
                className="avatar"
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                }}
              >
                V
              </div>
              <div
                className="avatar"
                style={{
                  background: "linear-gradient(135deg,#06b6d4,#3b82f6)",
                }}
              >
                M
              </div>
              <div
                className="avatar"
                style={{
                  background: "linear-gradient(135deg,#10b981,#06b6d4)",
                }}
              >
                A
              </div>
              <div
                className="avatar"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px dashed #333",
                  color: "#555",
                }}
              >
                +5
              </div>
            </div>
          </div>

          {/* Drag & drop */}
          <div className="bento-card b2 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}
            >
              ⟺
            </div>
            <div className="bento-title">LexoRank Ordering</div>
            <div className="bento-desc">
              Drag cards between lists with buttery-smooth reordering. LexoRank
              string-based ordering — the same algorithm used by Jira and Linear.
            </div>
            <div className="drag-demo">
              <div className="drag-col">
                <div className="drag-col-header">● TODO</div>
                <div className="drag-item" style={{ borderColor: "#a78bfa" }}>
                  Design mockups
                </div>
                <div className="drag-item" style={{ borderColor: "#a78bfa" }}>
                  API spec
                </div>
              </div>
              <div className="drag-col">
                <div className="drag-col-header" style={{ color: "#06b6d4" }}>
                  ● IN PROGRESS
                </div>
                <div className="drag-item" style={{ borderColor: "#06b6d4" }}>
                  Auth flow
                </div>
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="bento-card b3 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}
            >
              📈
            </div>
            <div className="bento-title">Analytics</div>
            <div className="bento-desc">
              Velocity trends, completion rates, and PDF export.
            </div>
            <div className="mini-analytics">
              <div className="chart-bars" id="chart-bars-landing">
                {[30, 45, 35, 70, 60, 85, 100].map((h, i) => (
                  <div
                    key={i}
                    className="chart-bar"
                    style={{
                      background:
                        i < 4
                          ? "linear-gradient(180deg,#a78bfa,#7c3aed)"
                          : i < 6
                            ? "linear-gradient(180deg,#06b6d4,#3b82f6)"
                            : "linear-gradient(180deg,#10b981,#06b6d4)",
                      height: `${h}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RBAC */}
          <div className="bento-card b4 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(236,72,153,0.1)", color: "#ec4899" }}
            >
              🔐
            </div>
            <div className="bento-title">Dual-gate RBAC</div>
            <div className="bento-desc">
              Organization + board-level roles. Guests can&apos;t see what they
              shouldn&apos;t.
            </div>
            <div className="security-rings">
              <div className="ring ring-4" />
              <div className="ring ring-3" />
              <div className="ring ring-2" />
              <div className="ring ring-1" />
              <div className="ring-center">🔒</div>
            </div>
          </div>

          {/* Audit log */}
          <div className="bento-card b5 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
            >
              📋
            </div>
            <div className="bento-title">Audit Logs</div>
            <div className="bento-desc">
              Complete activity history. Every action, every change, tracked
              forever.
            </div>
            <div className="audit-log-mock">
              <div>
                <span style={{ color: "#10b981" }}>✓</span>{" "}
                <span style={{ color: "#a78bfa" }}>viraj</span> moved card{" "}
                <span style={{ color: "#06b6d4" }}>Design</span> → Done
              </div>
              <div>
                <span style={{ color: "#10b981" }}>✓</span>{" "}
                <span style={{ color: "#ec4899" }}>maya</span> created board{" "}
                <span style={{ color: "#06b6d4" }}>Sprint 12</span>
              </div>
              <div>
                <span style={{ color: "#10b981" }}>✓</span>{" "}
                <span style={{ color: "#a78bfa" }}>viraj</span> invited{" "}
                <span style={{ color: "#f59e0b" }}>alex@co.io</span>
              </div>
              <div style={{ opacity: 0.4 }}>• • •</div>
            </div>
          </div>

          {/* Billing */}
          <div className="bento-card b6 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}
            >
              💳
            </div>
            <div className="bento-title">Stripe Billing</div>
            <div className="bento-desc">
              Seamless subscription management. Upgrade, downgrade, cancel — with
              full webhook reliability and invoice history.
            </div>
            <div className="pricing-cards">
              <div className="pricing-card">
                <div className="pricing-tier">FREE</div>
                <div className="pricing-amount">$0</div>
                <div className="pricing-detail">5 boards · 1 org</div>
              </div>
              <div className="pricing-card pro">
                <div className="pricing-badge">PRO</div>
                <div className="pricing-tier" style={{ marginTop: 4 }}>
                  PRO
                </div>
                <div className="pricing-amount">
                  $12
                  <span style={{ fontSize: "0.7rem", color: "#555" }}>
                    /mo
                  </span>
                </div>
                <div className="pricing-detail">Unlimited · Analytics</div>
              </div>
            </div>
          </div>

          {/* Command palette */}
          <div className="bento-card b7 reveal">
            <div
              className="bento-icon"
              style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}
            >
              ⌘
            </div>
            <div className="bento-title">Command Palette</div>
            <div className="bento-desc">
              Hit Ctrl+K to instantly navigate anywhere, create boards, invite
              members, or toggle themes. Power-user workflows at your
              fingertips.
            </div>
            <div className="cmd-palette-mock">
              <div className="cmd-palette-search">
                <span style={{ color: "#555", fontSize: "0.8rem" }}>🔍</span>
                <span style={{ fontSize: "0.8rem", color: "#555" }}>
                  Search or type a command...
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.65rem",
                    background: "rgba(255,255,255,0.08)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    color: "#555",
                  }}
                >
                  ⌘K
                </span>
              </div>
              <div className="cmd-palette-results">
                <div className="cmd-result-item active">
                  <span>+</span> New Board
                </div>
                <div className="cmd-result-item">
                  <span>→</span> Go to Dashboard
                </div>
                <div className="cmd-result-item">
                  <span>🌙</span> Toggle Dark Mode
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCREENSHOT SHOWCASE ─── */}
      <section className="showcase-section" id="showcase">
        <div className="showcase-inner">
          <div className="reveal">
            <div className="section-label">Product Tour</div>
            <h2 className="section-title">
              Every screen,
              <br />
              <span className="accent">crafted with care</span>
            </h2>
          </div>
        </div>

        <div className="screenshots-track" ref={trackRef}>
          {/* Dashboard */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: "#ef4444" }} />
              <div className="chrome-dot" style={{ background: "#f59e0b" }} />
              <div className="chrome-dot" style={{ background: "#10b981" }} />
            </div>
            <div className="screen-dashboard" style={{ height: 240 }}>
              <div className="screen-header">
                <div className="screen-h-title">My Boards</div>
                <div style={{ fontSize: "0.65rem", color: "#555" }}>
                  7 boards in workspace
                </div>
              </div>
              <div className="screen-metric-row">
                <div className="screen-metric">
                  <div className="screen-metric-n">7</div>
                  <div className="screen-metric-l">Boards</div>
                </div>
                <div className="screen-metric">
                  <div
                    className="screen-metric-n"
                    style={{ color: "#06b6d4" }}
                  >
                    24
                  </div>
                  <div className="screen-metric-l">Cards</div>
                </div>
                <div className="screen-metric">
                  <div
                    className="screen-metric-n"
                    style={{ color: "#10b981" }}
                  >
                    7/7
                  </div>
                  <div className="screen-metric-l">Active</div>
                </div>
              </div>
              <div className="screen-boards-grid">
                <div className="screen-board-card c1">
                  <div className="screen-board-title">Hello</div>
                  <div className="screen-board-sub">Updated 1d ago</div>
                </div>
                <div className="screen-board-card c2">
                  <div className="screen-board-title">Praised</div>
                  <div className="screen-board-sub">Updated 3d ago</div>
                </div>
                <div className="screen-board-card c3">
                  <div className="screen-board-title">Monument</div>
                  <div className="screen-board-sub">5 days ago</div>
                </div>
                <div className="screen-board-card c5">
                  <div className="screen-board-title">NEXUS</div>
                  <div className="screen-board-sub">6 lists · 1 card</div>
                </div>
              </div>
            </div>
            <div className="screenshot-label">
              <span>Dashboard</span> — Board overview with workspace health
            </div>
          </div>

          {/* Kanban Board */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: "#ef4444" }} />
              <div className="chrome-dot" style={{ background: "#f59e0b" }} />
              <div className="chrome-dot" style={{ background: "#10b981" }} />
            </div>
            <div
              style={{
                height: 240,
                background: "#0a0a14",
                padding: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8, height: "100%" }}>
                {[
                  {
                    label: "Tasks",
                    color: "#a78bfa",
                    borderColor: "rgba(139,92,246,0.2)",
                    count: "0",
                    items: ["API Integration", "Code Review"],
                  },
                  {
                    label: "Not Done",
                    color: "#06b6d4",
                    borderColor: "rgba(6,182,212,0.2)",
                    count: "1",
                    items: [],
                    hasCard: true,
                  },
                  {
                    label: "Done",
                    color: "#10b981",
                    borderColor: "rgba(16,185,129,0.2)",
                    count: "0",
                    items: [],
                  },
                  {
                    label: "Todos",
                    color: "#ec4899",
                    borderColor: "rgba(139,92,246,0.1)",
                    count: "",
                    items: [],
                  },
                ].map((col, ci) => (
                  <div
                    key={ci}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      padding: 8,
                      border: `1px solid ${col.borderColor}`,
                      width: 130,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.6rem",
                        color: col.color,
                        marginBottom: 6,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      {col.label} {col.count && <span>{col.count}</span>}
                    </div>
                    {col.items.map((item, ii) => (
                      <div
                        key={ii}
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          borderRadius: 5,
                          padding: 6,
                          fontSize: "0.6rem",
                          color: "#ccc",
                          marginBottom: 4,
                          borderLeft: `2px solid ${col.color}`,
                        }}
                      >
                        {item}
                      </div>
                    ))}
                    {col.hasCard && (
                      <div
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          borderRadius: 5,
                          overflow: "hidden",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            height: 30,
                            background:
                              "linear-gradient(135deg,#1e3a5f,#1a2a4a)",
                          }}
                        />
                        <div
                          style={{
                            padding: "4px 6px",
                            fontSize: "0.6rem",
                            color: "#ccc",
                          }}
                        >
                          Design
                        </div>
                        <div
                          style={{
                            padding: "0 6px 4px",
                            display: "flex",
                            gap: 3,
                          }}
                        >
                          <span
                            style={{
                              background: "#f97316",
                              color: "white",
                              padding: "1px 5px",
                              borderRadius: 3,
                              fontSize: "0.55rem",
                            }}
                          >
                            High
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="screenshot-label">
              <span>Kanban Board</span> — Drag &amp; drop with LexoRank
              ordering
            </div>
          </div>

          {/* Analytics */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: "#ef4444" }} />
              <div className="chrome-dot" style={{ background: "#f59e0b" }} />
              <div className="chrome-dot" style={{ background: "#10b981" }} />
            </div>
            <div
              style={{ height: 240, background: "#0a0a14", padding: 14 }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-syne), 'Syne', sans-serif",
                  marginBottom: 10,
                }}
              >
                Analytics Dashboard
              </div>
              <div
                style={{ display: "flex", gap: 6, marginBottom: 10 }}
              >
                {[
                  { n: "1", l: "Total Cards", c: undefined, bc: "rgba(255,255,255,0.06)" },
                  { n: "1", l: "Completed", c: "#10b981", bc: "rgba(16,185,129,0.2)" },
                  { n: "371h", l: "Avg Time", c: "#a78bfa", bc: "rgba(255,255,255,0.06)" },
                ].map((m, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 6,
                      padding: 8,
                      border: `1px solid ${m.bc}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        fontFamily: "var(--font-syne), 'Syne', sans-serif",
                        color: m.c,
                      }}
                    >
                      {m.n}
                    </div>
                    <div style={{ fontSize: "0.55rem", color: "#555" }}>
                      {m.l}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#888",
                    marginBottom: 8,
                  }}
                >
                  Velocity Trend (7 Days)
                </div>
                <svg
                  viewBox="0 0 280 50"
                  style={{ width: "100%", height: 50 }}
                >
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#10b981"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,48 L40,46 L80,44 L120,40 L160,30 L200,20 L240,10 L280,2"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={1.5}
                  />
                  <path
                    d="M0,48 L40,46 L80,44 L120,40 L160,30 L200,20 L240,10 L280,2 L280,50 L0,50Z"
                    fill="url(#vg)"
                  />
                  <circle cx={280} cy={2} r={3} fill="#10b981" />
                </svg>
              </div>
            </div>
            <div className="screenshot-label">
              <span>Analytics</span> — Velocity, completion rates, PDF export
            </div>
          </div>

          {/* Activity Feed */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: "#ef4444" }} />
              <div className="chrome-dot" style={{ background: "#f59e0b" }} />
              <div className="chrome-dot" style={{ background: "#10b981" }} />
            </div>
            <div
              style={{
                height: 240,
                background: "#0a0a14",
                padding: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-syne), 'Syne', sans-serif",
                  marginBottom: 4,
                }}
              >
                Activity Feed
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "#555",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div className="hero-badge-dot" />
                Live · syncing via Supabase
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  {
                    initial: "V",
                    grad: "linear-gradient(135deg,#7c3aed,#ec4899)",
                    user: "viraj",
                    uc: "#a78bfa",
                    action: "moved",
                    target: "Design",
                    tc: "#06b6d4",
                    suffix: "to Done",
                    time: "2 min ago",
                  },
                  {
                    initial: "M",
                    grad: "linear-gradient(135deg,#06b6d4,#3b82f6)",
                    user: "maya",
                    uc: "#06b6d4",
                    action: "created board",
                    target: "Masters",
                    tc: "#10b981",
                    suffix: "",
                    time: "15 min ago",
                  },
                  {
                    initial: "A",
                    grad: "linear-gradient(135deg,#f97316,#ef4444)",
                    user: "alex",
                    uc: "#ec4899",
                    action: "updated card priority to",
                    target: "High",
                    tc: "#ef4444",
                    suffix: "",
                    time: "1h ago",
                  },
                  {
                    initial: "V",
                    grad: "linear-gradient(135deg,#7c3aed,#ec4899)",
                    user: "viraj",
                    uc: "#a78bfa",
                    action: "added list",
                    target: "Todos",
                    tc: "#06b6d4",
                    suffix: "",
                    time: "2h ago",
                  },
                ].map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: entry.grad,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.6rem",
                      }}
                    >
                      {entry.initial}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: "#ccc" }}>
                        <span style={{ color: entry.uc }}>{entry.user}</span>{" "}
                        {entry.action}{" "}
                        <span style={{ color: entry.tc }}>{entry.target}</span>
                        {entry.suffix ? ` ${entry.suffix}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: "0.55rem",
                          color: "#444",
                          marginTop: 2,
                        }}
                      >
                        {entry.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="screenshot-label">
              <span>Activity Feed</span> — Complete audit trail with timestamps
            </div>
          </div>

          {/* Billing */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: "#ef4444" }} />
              <div className="chrome-dot" style={{ background: "#f59e0b" }} />
              <div className="chrome-dot" style={{ background: "#10b981" }} />
            </div>
            <div
              style={{ height: 240, background: "#0a0a14", padding: 14 }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "var(--font-syne), 'Syne', sans-serif",
                  marginBottom: 12,
                }}
              >
                Billing &amp; Plans
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#888",
                      marginBottom: 4,
                    }}
                  >
                    FREE
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      fontFamily: "var(--font-syne), 'Syne', sans-serif",
                    }}
                  >
                    $0
                  </div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "#555",
                      marginTop: 4,
                    }}
                  >
                    5 boards
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: 12,
                    border: "1px solid rgba(139,92,246,0.4)",
                    background: "rgba(139,92,246,0.08)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -7,
                      left: 8,
                      background:
                        "linear-gradient(135deg,#7c3aed,#ec4899)",
                      padding: "1px 7px",
                      borderRadius: 999,
                      fontSize: "0.5rem",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    CURRENT
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#a78bfa",
                      marginBottom: 4,
                      marginTop: 2,
                    }}
                  >
                    PRO
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      fontFamily: "var(--font-syne), 'Syne', sans-serif",
                    }}
                  >
                    $12
                    <span style={{ fontSize: "0.6rem", color: "#555" }}>
                      /mo
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "#555",
                      marginTop: 4,
                    }}
                  >
                    Unlimited
                  </div>
                </div>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#888",
                    marginBottom: 6,
                  }}
                >
                  Storage Usage
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 999,
                    height: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "24%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg,#7c3aed,#06b6d4)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "0.55rem",
                    color: "#555",
                    marginTop: 4,
                  }}
                >
                  24% of 5GB used
                </div>
              </div>
            </div>
            <div className="screenshot-label">
              <span>Billing</span> — Stripe-powered subscription management
            </div>
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW ─── */}
      <section className="workflow-section" id="workflow">
        <div className="reveal">
          <div className="section-label">How it works</div>
          <h2 className="section-title">
            Up and running
            <br />
            in <span className="accent">4 steps</span>
          </h2>
        </div>

        <div className="workflow-steps">
          {[
            {
              icon: "🏗️",
              title: "Create workspace",
              desc: "Sign up and create your organization. Invite teammates via email with customizable roles.",
            },
            {
              icon: "📋",
              title: "Build your boards",
              desc: "Create unlimited boards, add lists, and start filling cards. Beautiful gradient covers included.",
            },
            {
              icon: "⚡",
              title: "Collaborate live",
              desc: "See updates in real-time as your team moves cards, leaves comments, and changes priorities.",
            },
            {
              icon: "📊",
              title: "Track progress",
              desc: "Dive into velocity analytics, export PDF reports, and monitor workspace health — all live.",
            },
          ].map((step, i) => (
            <div
              key={i}
              className="workflow-step reveal"
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <div className="step-num">{step.icon}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TECH STACK ─── */}
      <section className="tech-section">
        <div className="tech-label">
          Powered by world-class infrastructure
        </div>
        <div className="tech-track-wrapper">
          <div className="tech-track">
            {/* Render twice for infinite scroll illusion */}
            {[...TECH_ITEMS, ...TECH_ITEMS].map((t, i) => (
              <div key={i} className="tech-item">
                <div className="tech-dot" style={{ background: t.color }} />
                {t.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 className="cta-title reveal">
            Ship faster.
            <br />
            <span>Build together.</span>
          </h2>
          <p className="cta-sub reveal">
            Start free. No credit card. No limits on what you can build.
          </p>
          <div className="cta-actions reveal">
            <Link
              href="/sign-up"
              className="btn-primary"
              style={{ fontSize: "1.1rem", padding: "16px 40px" }}
            >
              Start for free →
            </Link>
            <Link
              href="/sign-in"
              className="btn-ghost"
              style={{ fontSize: "1.1rem", padding: "16px 32px" }}
            >
              Sign in
            </Link>
          </div>
          <p className="cta-note reveal">
            <span>Free forever</span> · <span>No credit card</span> ·{" "}
            <span>Upgrade anytime</span>
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="landing-footer">
        <div className="footer-logo">✦ NEXUS</div>
        <div className="footer-copy">
          © 2026 Nexus. Built with Next.js, Prisma &amp; Supabase.
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">GitHub</a>
          <Link href="/sign-up">Get started</Link>
        </div>
      </footer>
    </div>
  );
}
