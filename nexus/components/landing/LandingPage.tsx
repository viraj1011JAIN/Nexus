'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './landing.css';

/* ============================================================
   Types for canvas animation
   ============================================================ */
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

/* ============================================================
   Tech stack items
   ============================================================ */
const TECH_STACK = [
  { name: 'Next.js 16', color: '#000' },
  { name: 'TypeScript', color: '#3b82f6' },
  { name: 'Supabase', color: '#3ecf8e' },
  { name: 'Prisma ORM', color: '#2563eb' },
  { name: 'Clerk Auth', color: '#6366f1' },
  { name: 'Stripe', color: '#7c3aed' },
  { name: 'Tailwind CSS', color: '#38bdf8' },
  { name: 'shadcn/ui', color: '#555' },
  { name: 'Vercel Edge', color: '#e11d48' },
  { name: 'LexoRank', color: '#f97316' },
];

/* ============================================================
   Component
   ============================================================ */
export default function LandingPage() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const mainBoardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  /* Drag demo state */
  const [demoColumn, setDemoColumn] = useState<'todo' | 'inprogress'>('todo');
  const [demoDragging, setDemoDragging] = useState(false);

  /* ── Effect 1: Custom cursor + parallax boards ── */
  useEffect(() => {
    const cursor = cursorRef.current;
    const trail = trailRef.current;
    const mainBoard = mainBoardRef.current;
    if (!cursor || !trail) return;

    const onMouseMove = (e: MouseEvent) => {
      const mx = e.clientX;
      const my = e.clientY;
      cursor.style.left = `${mx}px`;
      cursor.style.top = `${my}px`;
      setTimeout(() => {
        trail.style.left = `${mx}px`;
        trail.style.top = `${my}px`;
      }, 60);

      // Parallax on main board
      if (mainBoard) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const rx = ((e.clientY - cy) / cy) * 6;
        const ry = ((e.clientX - cx) / cx) * -6;
        mainBoard.style.transform = `translateX(-50%) rotateX(${8 + rx * 0.3}deg) rotateY(${ry * 0.3}deg)`;
      }
    };

    const wrapper = wrapperRef.current;
    const interactives = wrapper?.querySelectorAll('a, button') ?? [];

    const onEnter = () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(2.5)';
      cursor.style.background = '#ec4899';
    };

    const onLeave = () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(1)';
      cursor.style.background = '#8b5cf6';
    };

    document.addEventListener('mousemove', onMouseMove);
    interactives.forEach((el) => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      interactives.forEach((el) => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      });
    };
  }, []);

  /* ── Effect 2: Canvas nebula ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rawCtx = canvas.getContext('2d');
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let animFrame = 0;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Stars
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

    // Floating orbs
    const orbs: Orb[] = [
      { x: W * 0.2, y: H * 0.3, r: 300, hue: 270, dx: 0.3, dy: 0.2 },
      { x: W * 0.8, y: H * 0.2, r: 250, hue: 200, dx: -0.2, dy: 0.3 },
      { x: W * 0.5, y: H * 0.8, r: 200, hue: 310, dx: 0.15, dy: -0.25 },
    ];

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Draw orbs
      orbs.forEach((o) => {
        o.x += o.dx;
        o.y += o.dy;
        if (o.x < -o.r || o.x > W + o.r) o.dx *= -1;
        if (o.y < -o.r || o.y > H + o.r) o.dy *= -1;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},70%,55%,0.06)`);
        g.addColorStop(1, `hsla(${o.hue},70%,55%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw stars
      stars.forEach((s) => {
        s.x += s.dx;
        s.y += s.dy;
        s.a += s.da;
        if (s.a < 0.1) s.da = Math.abs(s.da);
        if (s.a > 0.9) s.da = -Math.abs(s.da);
        if (s.x < 0) s.x = W;
        if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H;
        if (s.y > H) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},70%,80%,${s.a})`;
        ctx.fill();
      });

      // Constellation lines
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animFrame = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /* ── Effect 3: Scroll reveal + chart bars observer ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const reveals = wrapper.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach((r) => revealObserver.observe(r));

    // Chart bars animation
    const chartBars = wrapper.querySelector('.chart-bars');
    const heights = [30, 45, 35, 70, 60, 85, 100];
    const barsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const bars = chartBars?.querySelectorAll('.bar');
          bars?.forEach((bar, i) => {
            const el = bar as HTMLElement;
            el.style.height = '0%';
            setTimeout(() => {
              el.style.transition = `height 0.8s ${i * 0.1}s ease`;
              el.style.height = `${heights[i]}%`;
            }, 500);
          });
        }
      },
      { threshold: 0.5 }
    );
    if (chartBars) barsObserver.observe(chartBars);

    return () => {
      revealObserver.disconnect();
      barsObserver.disconnect();
    };
  }, []);

  /* ── Effect 4: Screenshot track drag-scroll ── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      track.style.cursor = 'grabbing';
    };
    const onMouseLeave = () => {
      isDown = false;
      track.style.cursor = 'grab';
    };
    const onMouseUp = () => {
      isDown = false;
      track.style.cursor = 'grab';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 2;
      track.scrollLeft = scrollLeft - walk;
    };

    track.addEventListener('mousedown', onMouseDown);
    track.addEventListener('mouseleave', onMouseLeave);
    track.addEventListener('mouseup', onMouseUp);
    track.addEventListener('mousemove', onMouseMove);

    return () => {
      track.removeEventListener('mousedown', onMouseDown);
      track.removeEventListener('mouseleave', onMouseLeave);
      track.removeEventListener('mouseup', onMouseUp);
      track.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  /* ── Effect 5: Drag demo animation ── */
  useEffect(() => {
    let cancelled = false;

    function run() {
      if (cancelled) return;
      setDemoDragging(true);
      setTimeout(() => {
        if (cancelled) return;
        setDemoDragging(false);
        setDemoColumn('inprogress');
        setTimeout(() => {
          if (cancelled) return;
          setDemoColumn('todo');
        }, 2500);
      }, 600);
    }

    const initialTimeout = setTimeout(run, 2000);
    const interval = setInterval(run, 5000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  /* ── Effect 6: Animated stat counters ── */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const timeout = setTimeout(() => {
      const statNums = wrapper.querySelectorAll<HTMLElement>('.stat-num');
      statNums.forEach((el) => {
        const text = el.textContent;
        if (text === '10K+') {
          let count = 0;
          const iv = setInterval(() => {
            count += 200;
            el.textContent = count >= 10000 ? '10K+' : count.toLocaleString();
            if (count >= 10000) clearInterval(iv);
          }, 20);
        }
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  /* ── Smooth anchor scroll handler ── */
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  /* ============================================================
     JSX
     ============================================================ */
  return (
    <div className="nexus-landing" ref={wrapperRef}>
      {/* Custom cursor */}
      <div className="landing-cursor" ref={cursorRef} />
      <div className="landing-cursor-trail" ref={trailRef} />

      {/* Canvas background */}
      <canvas className="landing-canvas" ref={canvasRef} />

      {/* ─── NAV ─── */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">✦</div>
          NEXUS
        </div>
        <div className="nav-links">
          <a href="#features" onClick={(e) => handleAnchorClick(e, 'features')}>Features</a>
          <a href="#showcase" onClick={(e) => handleAnchorClick(e, 'showcase')}>Product</a>
          <a href="#workflow" onClick={(e) => handleAnchorClick(e, 'workflow')}>Workflow</a>
          <Link href="/sign-in">Sign In</Link>
          <Link href="/sign-up" className="nav-cta">Get Started</Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero" id="hero">
        <div className="hero-badge">
          <div className="hero-badge-dot" />
          Supabase Realtime · Now Live
        </div>

        <h1 className="hero-title">
          <span className="line1">Your team&apos;s work,</span>
          <span className="line2">beautifully connected.</span>
        </h1>

        <p className="hero-sub">
          NEXUS brings <span>drag-and-drop boards</span>, real-time collaboration, and
          enterprise analytics into one stunning workspace.
        </p>

        <div className="hero-actions">
          <Link href="/sign-up" className="btn-primary">
            <span>Start for free</span>
            <span>→</span>
          </Link>
          <a href="#showcase" className="btn-ghost" onClick={(e) => handleAnchorClick(e, 'showcase')}>
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

        {/* 3D Boards Showcase */}
        <div className="boards-showcase">
          {/* Left card */}
          <div className="board-float board-left">
            <div className="mock-header">
              <div className="mock-dot" style={{ background: '#ef4444' }} />
              <div className="mock-dot" style={{ background: '#f59e0b' }} />
              <div className="mock-dot" style={{ background: '#10b981' }} />
              <div className="mock-title">PROJECT · KANBAN</div>
            </div>
            <div className="screen-kanban" style={{ height: 160 }}>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div className="mock-list-dot" style={{ background: '#a78bfa' }} />TO DO
                </div>
                <div className="screen-kanban-item">API Integration</div>
                <div className="screen-kanban-item">Design review</div>
              </div>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div className="mock-list-dot" style={{ background: '#06b6d4' }} />IN PROGRESS
                </div>
                <div className="screen-kanban-item">Auth flow</div>
              </div>
              <div className="screen-kanban-col">
                <div className="screen-kanban-header">
                  <div className="mock-list-dot" style={{ background: '#10b981' }} />DONE
                </div>
                <div className="screen-kanban-item">Setup repo</div>
                <div className="screen-kanban-item">DB schema</div>
              </div>
            </div>
          </div>

          {/* Main card - Dashboard */}
          <div className="board-float board-main" ref={mainBoardRef}>
            <div className="mock-header">
              <div className="mock-dot" style={{ background: '#ef4444' }} />
              <div className="mock-dot" style={{ background: '#f59e0b' }} />
              <div className="mock-dot" style={{ background: '#10b981' }} />
              <div className="mock-title">NEXUS — My Boards</div>
            </div>
            <div className="mock-stats-row">
              <div className="mock-stat-chip">
                <div className="mock-stat-num">7</div>
                <div className="mock-stat-lbl">Boards</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: '#06b6d4' }}>24</div>
                <div className="mock-stat-lbl">Cards</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: '#10b981' }}>9</div>
                <div className="mock-stat-lbl">Lists</div>
              </div>
              <div className="mock-stat-chip">
                <div className="mock-stat-num" style={{ color: '#ec4899' }}>7/7</div>
                <div className="mock-stat-lbl">Active</div>
              </div>
            </div>
            <div className="mock-body">
              <div className="mock-board-card c1"><div className="mock-board-tag">DESIGN</div><span>Product Redesign</span></div>
              <div className="mock-board-card c2"><div className="mock-board-tag">DEV</div><span>API Sprint</span></div>
              <div className="mock-board-card c3"><div className="mock-board-tag">OPS</div><span>Q2 Launch</span></div>
              <div className="mock-board-card c4"><div className="mock-board-tag">RESEARCH</div><span>User Testing</span></div>
              <div className="mock-board-card c5"><div className="mock-board-tag">NEXUS</div><span>Masters</span></div>
              <div className="mock-board-card c6"><div className="mock-board-tag">MONUMENT</div><span>Born</span></div>
            </div>
          </div>

          {/* Right card - Analytics */}
          <div className="board-float board-right">
            <div className="mock-header">
              <div className="mock-dot" style={{ background: '#ef4444' }} />
              <div className="mock-dot" style={{ background: '#f59e0b' }} />
              <div className="mock-dot" style={{ background: '#10b981' }} />
              <div className="mock-title">ANALYTICS</div>
            </div>
            <div className="screen-analytics" style={{ height: 160 }}>
              <div style={{ fontSize: '0.65rem', color: '#10b981', marginBottom: 8 }}>● LIVE — Velocity Trend</div>
              <svg viewBox="0 0 200 60" style={{ width: '100%', height: 60 }}>
                <defs>
                  <linearGradient id="landing-lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path
                  d="M0,55 L20,52 L40,48 L60,45 L80,40 L100,32 L120,28 L140,20 L160,15 L180,8 L200,2"
                  fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round"
                />
                <path
                  d="M0,55 L20,52 L40,48 L60,45 L80,40 L100,32 L120,28 L140,20 L160,15 L180,8 L200,2 L200,60 L0,60 Z"
                  fill="url(#landing-lineGrad)"
                />
              </svg>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div style={{ fontSize: '0.6rem', color: '#555' }}>Completed <span style={{ color: '#10b981' }}>↑ 42%</span></div>
                <div style={{ fontSize: '0.6rem', color: '#555' }}>Velocity <span style={{ color: '#a78bfa' }}>↑ 18%</span></div>
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
            Built for how<br />teams <span className="accent">actually work</span>
          </h2>
        </div>

        <div className="bento-grid">
          {/* Real-time collab */}
          <div className="bento-card b1 reveal">
            <div className="bento-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>⚡</div>
            <div className="bento-title">Real-time Collaboration</div>
            <div className="bento-desc">
              See teammates&apos; cursors, updates, and presence live. Powered by Supabase WebSocket channels with sub-50ms latency — no refresh ever needed.
            </div>
            <div className="live-badge"><div className="hero-badge-dot" /> 3 members active now</div>
            <div className="collab-avatars">
              <div className="avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>V</div>
              <div className="avatar" style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>M</div>
              <div className="avatar" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>A</div>
              <div className="avatar" style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed #333', color: '#555' }}>+5</div>
            </div>
          </div>

          {/* Drag & drop */}
          <div className="bento-card b2 reveal">
            <div className="bento-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>⟺</div>
            <div className="bento-title">LexoRank Ordering</div>
            <div className="bento-desc">
              Drag cards between lists with buttery-smooth reordering. LexoRank string-based ordering — the same algorithm used by Jira and Linear.
            </div>
            <div className="drag-demo">
              <div className="drag-col">
                <div className="drag-col-header">● TODO</div>
                {demoColumn === 'todo' && (
                  <div
                    className={`drag-item${demoDragging ? ' dragging' : ''}`}
                    style={{ borderColor: '#a78bfa' }}
                  >
                    Design mockups
                  </div>
                )}
                <div className="drag-item" style={{ borderColor: '#a78bfa' }}>API spec</div>
              </div>
              <div className="drag-col">
                <div className="drag-col-header" style={{ color: '#06b6d4' }}>● IN PROGRESS</div>
                <div className="drag-item" style={{ borderColor: '#06b6d4' }}>Auth flow</div>
                {demoColumn === 'inprogress' && (
                  <div className="drag-item" style={{ borderColor: '#06b6d4' }}>
                    Design mockups
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="bento-card b3 reveal">
            <div className="bento-icon" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>📈</div>
            <div className="bento-title">Analytics</div>
            <div className="bento-desc">Velocity trends, completion rates, and PDF export.</div>
            <div className="mini-analytics">
              <div className="chart-bars">
                {[30, 45, 35, 70, 60, 85, 100].map((h, i) => (
                  <div
                    key={i}
                    className="bar"
                    style={{
                      background: i < 4
                        ? 'linear-gradient(180deg,#a78bfa,#7c3aed)'
                        : i < 6
                          ? 'linear-gradient(180deg,#06b6d4,#3b82f6)'
                          : 'linear-gradient(180deg,#10b981,#06b6d4)',
                      height: `${h}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RBAC */}
          <div className="bento-card b4 reveal">
            <div className="bento-icon" style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>🔐</div>
            <div className="bento-title">Dual-gate RBAC</div>
            <div className="bento-desc">Organization + board-level roles. Guests can&apos;t see what they shouldn&apos;t.</div>
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
            <div className="bento-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>📋</div>
            <div className="bento-title">Audit Logs</div>
            <div className="bento-desc">Complete activity history. Every action, every change, tracked forever.</div>
            <div style={{ marginTop: 16, fontSize: '0.65rem', color: '#555', fontFamily: 'monospace', lineHeight: 2 }}>
              <div><span style={{ color: '#10b981' }}>✓</span> <span style={{ color: '#a78bfa' }}>viraj</span> moved card <span style={{ color: '#06b6d4' }}>Design</span> → Done</div>
              <div><span style={{ color: '#10b981' }}>✓</span> <span style={{ color: '#ec4899' }}>maya</span> created board <span style={{ color: '#06b6d4' }}>Sprint 12</span></div>
              <div><span style={{ color: '#10b981' }}>✓</span> <span style={{ color: '#a78bfa' }}>viraj</span> invited <span style={{ color: '#f59e0b' }}>alex@co.io</span></div>
              <div style={{ opacity: 0.4 }}>• • •</div>
            </div>
          </div>

          {/* Billing */}
          <div className="bento-card b6 reveal">
            <div className="bento-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>💳</div>
            <div className="bento-title">Stripe Billing</div>
            <div className="bento-desc">
              Seamless subscription management. Upgrade, downgrade, cancel — with full webhook reliability and invoice history.
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1,
                background: 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(236,72,153,0.05))',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: 12,
                padding: 16,
              }}>
                <div style={{ fontSize: '0.7rem', color: '#a78bfa', letterSpacing: '0.06em', marginBottom: 6 }}>FREE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif" }}>$0</div>
                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 4 }}>5 boards · 1 org</div>
              </div>
              <div style={{
                flex: 1,
                background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.1))',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: 12,
                padding: 16,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -8, left: 12,
                  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                  padding: '2px 8px', borderRadius: 999, fontSize: '0.55rem', color: 'white', fontWeight: 600,
                }}>PRO</div>
                <div style={{ fontSize: '0.7rem', color: '#a78bfa', letterSpacing: '0.06em', marginBottom: 6, marginTop: 4 }}>PRO</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif" }}>
                  $12<span style={{ fontSize: '0.7rem', color: '#555' }}>/mo</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 4 }}>Unlimited · Analytics</div>
              </div>
            </div>
          </div>

          {/* Command palette */}
          <div className="bento-card b7 reveal">
            <div className="bento-icon" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>⌘</div>
            <div className="bento-title">Command Palette</div>
            <div className="bento-desc">
              Hit Ctrl+K to instantly navigate anywhere, create boards, invite members, or toggle themes. Power-user workflows at your fingertips.
            </div>
            <div style={{
              marginTop: 20,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ color: '#555', fontSize: '0.8rem' }}>🔍</span>
                <span style={{ fontSize: '0.8rem', color: '#555' }}>Search or type a command...</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem',
                  background: 'rgba(255,255,255,0.08)', padding: '2px 6px',
                  borderRadius: 4, color: '#555',
                }}>⌘K</span>
              </div>
              <div style={{ padding: 8 }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(139,92,246,0.15)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: '0.75rem', color: '#a78bfa', marginBottom: 4,
                }}>
                  <span>+</span> New Board
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: '0.75rem', color: '#666', marginBottom: 4,
                }}>
                  <span>→</span> Go to Dashboard
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: '0.75rem', color: '#666',
                }}>
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
              Every screen,<br /><span className="accent">crafted with care</span>
            </h2>
          </div>
        </div>

        <div className="screenshots-track" ref={trackRef}>
          {/* Dashboard */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: '#ef4444' }} />
              <div className="chrome-dot" style={{ background: '#f59e0b' }} />
              <div className="chrome-dot" style={{ background: '#10b981' }} />
            </div>
            <div className="screen-dashboard" style={{ height: 240 }}>
              <div className="screen-header">
                <div className="screen-h-title">My Boards</div>
                <div style={{ fontSize: '0.65rem', color: '#555' }}>7 boards in workspace</div>
              </div>
              <div className="screen-metric-row">
                <div className="screen-metric"><div className="screen-metric-n">7</div><div className="screen-metric-l">Boards</div></div>
                <div className="screen-metric"><div className="screen-metric-n" style={{ color: '#06b6d4' }}>24</div><div className="screen-metric-l">Cards</div></div>
                <div className="screen-metric"><div className="screen-metric-n" style={{ color: '#10b981' }}>7/7</div><div className="screen-metric-l">Active</div></div>
              </div>
              <div className="screen-boards-grid">
                <div className="screen-board-card c1"><div className="screen-board-title">Hello</div><div className="screen-board-sub">Updated 1d ago</div></div>
                <div className="screen-board-card c2"><div className="screen-board-title">Praised</div><div className="screen-board-sub">Updated 3d ago</div></div>
                <div className="screen-board-card c3"><div className="screen-board-title">Monument</div><div className="screen-board-sub">5 days ago</div></div>
                <div className="screen-board-card c5"><div className="screen-board-title">NEXUS</div><div className="screen-board-sub">6 lists · 1 card</div></div>
              </div>
            </div>
            <div className="screenshot-label"><span>Dashboard</span> — Board overview with workspace health</div>
          </div>

          {/* Kanban Board */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: '#ef4444' }} />
              <div className="chrome-dot" style={{ background: '#f59e0b' }} />
              <div className="chrome-dot" style={{ background: '#10b981' }} />
            </div>
            <div style={{ height: 240, background: '#0a0a14', padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, height: '100%' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8,
                  border: '1px solid rgba(139,92,246,0.2)', width: 130, flexShrink: 0,
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#a78bfa', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>Tasks <span>0</span></div>
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 5, padding: 6, fontSize: '0.6rem', color: '#ccc', marginBottom: 4, borderLeft: '2px solid #a78bfa' }}>API Integration</div>
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 5, padding: 6, fontSize: '0.6rem', color: '#ccc', borderLeft: '2px solid #a78bfa' }}>Code Review</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8,
                  border: '1px solid rgba(6,182,212,0.2)', width: 130, flexShrink: 0,
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#06b6d4', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>Not Done <span>1</span></div>
                  <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 5, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: 30, background: 'linear-gradient(135deg,#1e3a5f,#1a2a4a)' }} />
                    <div style={{ padding: '4px 6px', fontSize: '0.6rem', color: '#ccc' }}>Design</div>
                    <div style={{ padding: '0 6px 4px', display: 'flex', gap: 3 }}>
                      <span style={{ background: '#f97316', color: 'white', padding: '1px 5px', borderRadius: 3, fontSize: '0.55rem' }}>High</span>
                    </div>
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8,
                  border: '1px solid rgba(16,185,129,0.2)', width: 130, flexShrink: 0,
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#10b981', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>Done <span>0</span></div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8,
                  border: '1px solid rgba(139,92,246,0.1)', width: 130, flexShrink: 0,
                }}>
                  <div style={{ fontSize: '0.6rem', color: '#ec4899', marginBottom: 6 }}>Todos</div>
                </div>
              </div>
            </div>
            <div className="screenshot-label"><span>Kanban Board</span> — Drag &amp; drop with LexoRank ordering</div>
          </div>

          {/* Analytics */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: '#ef4444' }} />
              <div className="chrome-dot" style={{ background: '#f59e0b' }} />
              <div className="chrome-dot" style={{ background: '#10b981' }} />
            </div>
            <div style={{ height: 240, background: '#0a0a14', padding: 14 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: "var(--font-syne), 'Syne', sans-serif", marginBottom: 10 }}>Analytics Dashboard</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif" }}>1</div>
                  <div style={{ fontSize: '0.55rem', color: '#555' }}>Total Cards</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif", color: '#10b981' }}>1</div>
                  <div style={{ fontSize: '0.55rem', color: '#555' }}>Completed</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif", color: '#a78bfa' }}>371h</div>
                  <div style={{ fontSize: '0.55rem', color: '#555' }}>Avg Time</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: 8 }}>Velocity Trend (7 Days)</div>
                <svg viewBox="0 0 280 50" style={{ width: '100%', height: 50 }}>
                  <defs>
                    <linearGradient id="landing-vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d="M0,48 L40,46 L80,44 L120,40 L160,30 L200,20 L240,10 L280,2" fill="none" stroke="#10b981" strokeWidth={1.5} />
                  <path d="M0,48 L40,46 L80,44 L120,40 L160,30 L200,20 L240,10 L280,2 L280,50 L0,50Z" fill="url(#landing-vg)" />
                  <circle cx="280" cy="2" r="3" fill="#10b981" />
                </svg>
              </div>
            </div>
            <div className="screenshot-label"><span>Analytics</span> — Velocity, completion rates, PDF export</div>
          </div>

          {/* Activity Feed */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: '#ef4444' }} />
              <div className="chrome-dot" style={{ background: '#f59e0b' }} />
              <div className="chrome-dot" style={{ background: '#10b981' }} />
            </div>
            <div style={{ height: 240, background: '#0a0a14', padding: 14, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: "var(--font-syne), 'Syne', sans-serif", marginBottom: 4 }}>Activity Feed</div>
              <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="hero-badge-dot" />Live · syncing via Supabase
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { avatar: 'V', gradient: '#7c3aed,#ec4899', user: 'viraj', userColor: '#a78bfa', action: 'moved', target: 'Design', targetColor: '#06b6d4', suffix: 'to Done', time: '2 min ago' },
                  { avatar: 'M', gradient: '#06b6d4,#3b82f6', user: 'maya', userColor: '#06b6d4', action: 'created board', target: 'Masters', targetColor: '#10b981', suffix: '', time: '15 min ago' },
                  { avatar: 'A', gradient: '#f97316,#ef4444', user: 'alex', userColor: '#ec4899', action: 'updated card priority to', target: 'High', targetColor: '#ef4444', suffix: '', time: '1h ago' },
                  { avatar: 'V', gradient: '#7c3aed,#ec4899', user: 'viraj', userColor: '#a78bfa', action: 'added list', target: 'Todos', targetColor: '#06b6d4', suffix: '', time: '2h ago' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: `linear-gradient(135deg,${item.gradient})`,
                      flexShrink: 0, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.6rem',
                    }}>{item.avatar}</div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#ccc' }}>
                        <span style={{ color: item.userColor }}>{item.user}</span> {item.action} <span style={{ color: item.targetColor }}>{item.target}</span> {item.suffix}
                      </div>
                      <div style={{ fontSize: '0.55rem', color: '#444', marginTop: 2 }}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="screenshot-label"><span>Activity Feed</span> — Complete audit trail with timestamps</div>
          </div>

          {/* Billing */}
          <div className="screenshot-card reveal">
            <div className="screenshot-chrome">
              <div className="chrome-dot" style={{ background: '#ef4444' }} />
              <div className="chrome-dot" style={{ background: '#f59e0b' }} />
              <div className="chrome-dot" style={{ background: '#10b981' }} />
            </div>
            <div style={{ height: 240, background: '#0a0a14', padding: 14 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: "var(--font-syne), 'Syne', sans-serif", marginBottom: 12 }}>Billing &amp; Plans</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{
                  flex: 1, borderRadius: 10, padding: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 4 }}>FREE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif" }}>$0</div>
                  <div style={{ fontSize: '0.6rem', color: '#555', marginTop: 4 }}>5 boards</div>
                </div>
                <div style={{
                  flex: 1, borderRadius: 10, padding: 12,
                  border: '1px solid rgba(139,92,246,0.4)',
                  background: 'rgba(139,92,246,0.08)',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', top: -7, left: 8,
                    background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                    padding: '1px 7px', borderRadius: 999, fontSize: '0.5rem',
                    color: 'white', fontWeight: 600,
                  }}>CURRENT</div>
                  <div style={{ fontSize: '0.7rem', color: '#a78bfa', marginBottom: 4, marginTop: 2 }}>PRO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: "var(--font-syne), 'Syne', sans-serif" }}>
                    $12<span style={{ fontSize: '0.6rem', color: '#555' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#555', marginTop: 4 }}>Unlimited</div>
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: 6 }}>Storage Usage</div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: '24%', height: '100%', background: 'linear-gradient(90deg,#7c3aed,#06b6d4)', borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: '0.55rem', color: '#555', marginTop: 4 }}>24% of 5GB used</div>
              </div>
            </div>
            <div className="screenshot-label"><span>Billing</span> — Stripe-powered subscription management</div>
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW ─── */}
      <section className="workflow-section" id="workflow">
        <div className="reveal">
          <div className="section-label">How it works</div>
          <h2 className="section-title">
            Up and running<br />in <span className="accent">4 steps</span>
          </h2>
        </div>

        <div className="workflow-steps">
          {[
            { icon: '🏗️', title: 'Create workspace', desc: 'Sign up and create your organization. Invite teammates via email with customizable roles.' },
            { icon: '📋', title: 'Build your boards', desc: 'Create unlimited boards, add lists, and start filling cards. Beautiful gradient covers included.' },
            { icon: '⚡', title: 'Collaborate live', desc: 'See updates in real-time as your team moves cards, leaves comments, and changes priorities.' },
            { icon: '📊', title: 'Track progress', desc: 'Dive into velocity analytics, export PDF reports, and monitor workspace health — all live.' },
          ].map((step, i) => (
            <div className="workflow-step reveal" key={i}>
              <div className="step-num">{step.icon}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TECH STACK ─── */}
      <section className="tech-section">
        <div className="tech-label">Powered by world-class infrastructure</div>
        <div className="tech-track-wrapper">
          <div className="tech-track">
            {/* Duplicate for infinite scroll */}
            {[...TECH_STACK, ...TECH_STACK].map((tech, i) => (
              <div className="tech-item" key={i}>
                <div className="tech-dot" style={{ background: tech.color }} />
                {tech.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="cta-title reveal">
            Ship faster.<br />
            <span>Build together.</span>
          </h2>
          <p className="cta-sub reveal">Start free. No credit card. No limits on what you can build.</p>
          <div className="cta-actions reveal">
            <Link href="/sign-up" className="btn-primary" style={{ fontSize: '1.1rem', padding: '16px 40px' }}>
              Start for free →
            </Link>
            <Link href="/sign-in" className="btn-ghost" style={{ fontSize: '1.1rem', padding: '16px 32px' }}>
              Sign in
            </Link>
          </div>
          <p className="cta-note reveal">
            <span>Free forever</span> · <span>No credit card</span> · <span>Upgrade anytime</span>
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="landing-footer">
        <div className="footer-logo">✦ NEXUS</div>
        <div className="footer-copy">© 2026 Nexus. Built with Next.js, Prisma &amp; Supabase.</div>
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
