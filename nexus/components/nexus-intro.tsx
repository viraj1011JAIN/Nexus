"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// ─── Client-only detection (avoids hydration mismatch) ───────────────────────
// useSyncExternalStore with getServerSnapshot = false ensures:
//   - Server: returns false → component renders null → no HTML to mismatch
//   - Client: returns true → renders the full animation
// React handles the server→client transition without hydration warnings.
const _sub = () => () => {};
const _clientSnap = () => true;
const _serverSnap = () => false;
function useIsClient() {
  return useSyncExternalStore(_sub, _clientSnap, _serverSnap);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_KEY   = "nexus_intro_v4";
const TOTAL_FRAMES  = 700;

const PAL = ["#7C3AED","#A855F7","#EC4899","#06B6D4","#14B8A6","#00FF88","#F59E0B"];

const TECH_WORDS = [
  "Next.js","React","TypeScript","Prisma","PostgreSQL","Supabase","Clerk","Stripe",
  "LexoRank","Zod","TipTap","Yjs","Framer","Recharts","Vercel","OpenAI","Sentry",
  "Axiom","Playwright","Jest","WebPush","VAPID","Tailwind","shadcn","Radix","dnd-kit",
  "Zustand","Resend",
];

const STACK = [
  { n:"Next.js",    c:"#E2E8F0", bg:"rgba(226,232,240,.06)", bd:"rgba(226,232,240,.14)" },
  { n:"React 19",   c:"#61DAFB", bg:"rgba(97,218,251,.07)",  bd:"rgba(97,218,251,.18)"  },
  { n:"TypeScript", c:"#60A5FA", bg:"rgba(96,165,250,.07)",  bd:"rgba(96,165,250,.18)"  },
  { n:"Prisma",     c:"#C084FC", bg:"rgba(192,132,252,.07)", bd:"rgba(192,132,252,.18)" },
  { n:"Supabase",   c:"#34D399", bg:"rgba(52,211,153,.07)",  bd:"rgba(52,211,153,.18)"  },
  { n:"Clerk",      c:"#818CF8", bg:"rgba(129,140,248,.07)", bd:"rgba(129,140,248,.18)" },
  { n:"Stripe",     c:"#A78BFA", bg:"rgba(167,139,250,.07)", bd:"rgba(167,139,250,.18)" },
  { n:"OpenAI",     c:"#4ADE80", bg:"rgba(74,222,128,.06)",  bd:"rgba(74,222,128,.16)"  },
  { n:"Framer",     c:"#F472B6", bg:"rgba(244,114,182,.07)", bd:"rgba(244,114,182,.18)" },
  { n:"Vercel",     c:"#F1F5F9", bg:"rgba(241,245,249,.05)", bd:"rgba(241,245,249,.12)" },
  { n:"Tailwind",   c:"#22D3EE", bg:"rgba(34,211,238,.07)",  bd:"rgba(34,211,238,.18)"  },
  { n:"TipTap",     c:"#FCD34D", bg:"rgba(252,211,77,.07)",  bd:"rgba(252,211,77,.18)"  },
  { n:"LexoRank",   c:"#C084FC", bg:"rgba(192,132,252,.07)", bd:"rgba(192,132,252,.18)" },
  { n:"Playwright", c:"#86EFAC", bg:"rgba(134,239,172,.06)", bd:"rgba(134,239,172,.16)" },
  { n:"Jest",       c:"#FCA5A5", bg:"rgba(252,165,165,.07)", bd:"rgba(252,165,165,.18)" },
  { n:"Zod",        c:"#93C5FD", bg:"rgba(147,197,253,.07)", bd:"rgba(147,197,253,.16)" },
  { n:"Recharts",   c:"#22D3EE", bg:"rgba(34,211,238,.06)",  bd:"rgba(34,211,238,.14)"  },
  { n:"Zustand",    c:"#FB923C", bg:"rgba(251,146,60,.07)",  bd:"rgba(251,146,60,.18)"  },
];

const BADGE_POS = [
  { l:"5%",  t:"6%"  }, { l:"22%", t:"4%"  }, { l:"40%", t:"5%"  },
  { l:"57%", t:"4%"  }, { l:"74%", t:"6%"  }, { l:"87%", t:"5%"  },
  { l:"1%",  t:"22%" }, { l:"0%",  t:"38%" }, { l:"1%",  t:"55%" },
  { l:"2%",  t:"70%" }, { l:"1%",  t:"83%" }, { l:"88%", t:"18%" },
  { l:"90%", t:"34%" }, { l:"89%", t:"50%" }, { l:"88%", t:"65%" },
  { l:"89%", t:"80%" }, { l:"15%", t:"91%" }, { l:"52%", t:"92%" },
];

// ─── BUG FIX 1: Stream data generated ONCE at module level ───────────────────
// Previously rand() was called inside JSX render, so every setProgress call
// (60×/sec) regenerated column positions & durations → streams flickered/jumped.
// Moving this to module scope means values are stable across all re-renders.
const STREAM_COLS = Array.from({ length: 20 }, (_, i) => ({
  left:     `${(i / 20) * 100 + (Math.random() * 2 - 1)}%`,
  duration: `${(Math.random() * 4.5 + 3.5).toFixed(1)}s`,
  delay:    `${(Math.random() * 4).toFixed(1)}s`,
  color:    ["#7C3AED","#06B6D4","#EC4899","#14B8A6","#A855F7"][i % 5],
  words:    Array.from({ length: 14 }, () =>
    TECH_WORDS[Math.floor(Math.random() * TECH_WORDS.length)]
  ),
}));

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "drift" | "converge" | "orbit" | "ambient";
interface Star       { x:number; y:number; r:number; a:number; tw:number; spd:number; col:string }
interface Shockwave  { x:number; y:number; r:number; col:string; a:number; spd:number }
interface Ray        { x:number; y:number; ang:number; len:number; maxLen:number; a:number; spd:number; col:string; w:number }
interface TrailPoint { x:number; y:number; a:number }
interface Particle {
  x:number; y:number; vx:number; vy:number; r:number;
  a:number; ma:number; col:string;
  trail:TrailPoint[]; tLen:number;
  orA:number; orR:number; orSpd:number;
  pulse:number; ps:number; noiseO:number;
  convDelay:number; tx:number; ty:number; life:number;
}

// ─── Pure utils ───────────────────────────────────────────────────────────────
const PI2   = Math.PI * 2;
const rand  = (a:number, b:number) => Math.random() * (b - a) + a;
const ri    = (a:number, b:number) => Math.floor(rand(a, b + 1));
const clamp = (v:number, lo:number, hi:number) => Math.min(Math.max(v, lo), hi);
const lerp  = (a:number, b:number, t:number) => a + (b - a) * t;
const hex2  = (n:number) => Math.floor(clamp(n, 0, 1) * 255).toString(16).padStart(2, "0");

// ─── Canvas helpers (unchanged) ───────────────────────────────────────────────
function buildStars(W:number, H:number): Star[] {
  return Array.from({ length: 220 }, () => ({
    x:rand(0,W), y:rand(0,H), r:rand(0.25,1.6),
    a:rand(0.1,0.55), tw:rand(0,PI2), spd:rand(0.008,0.035),
    col:PAL[ri(0, PAL.length - 1)],
  }));
}

function drawStars(ctx:CanvasRenderingContext2D, stars:Star[], W:number, H:number) {
  ctx.clearRect(0, 0, W, H);
  for (const s of stars) {
    s.tw += s.spd;
    const a = s.a * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, PI2);
    ctx.fillStyle = s.col + hex2(a);
    ctx.fill();
  }
}

function tickShockwaves(ctx:CanvasRenderingContext2D, sw:Shockwave[]) {
  for (let i = sw.length - 1; i >= 0; i--) {
    const s = sw[i];
    s.r += s.spd; s.a *= 0.935; s.spd *= 0.98;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, PI2);
    ctx.strokeStyle = s.col + hex2(s.a);
    ctx.lineWidth = 2; ctx.stroke();
    if (s.a < 0.01) sw.splice(i, 1);
  }
}

function tickRays(ctx:CanvasRenderingContext2D, rays:Ray[]) {
  for (let i = rays.length - 1; i >= 0; i--) {
    const r = rays[i];
    r.len = Math.min(r.len + r.spd, r.maxLen); r.a *= 0.965;
    ctx.beginPath(); ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + Math.cos(r.ang) * r.len, r.y + Math.sin(r.ang) * r.len);
    ctx.strokeStyle = r.col + hex2(r.a * (200 / 255));
    ctx.lineWidth = r.w; ctx.stroke();
    if (r.a < 0.01) rays.splice(i, 1);
  }
}

function newParticle(W:number, H:number, CX:number, CY:number): Particle {
  return {
    x:rand(0,W), y:rand(0,H), vx:rand(-0.4,0.4), vy:rand(-0.4,0.4),
    r:rand(0.8,2.8), a:0, ma:rand(0.3,0.95),
    col:PAL[ri(0, PAL.length - 1)],
    trail:[], tLen:ri(2,7),
    orA:rand(0,PI2), orR:rand(95, Math.min(W,H)*0.38),
    orSpd:rand(0.003,0.018) * (Math.random() > 0.5 ? 1 : -1),
    pulse:rand(0,PI2), ps:rand(0.02,0.06),
    noiseO:rand(0,1000), convDelay:rand(0,80),
    tx:CX, ty:CY, life:0,
  };
}

function updateParticle(p:Particle, phase:Phase, CX:number, CY:number, W:number, H:number) {
  p.pulse += p.ps; p.life++;
  if (phase === "drift") {
    p.vx += (Math.random() - 0.5) * 0.018;
    p.vy += (Math.random() - 0.5) * 0.018;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    p.a = lerp(p.a, p.ma * 0.45, 0.025);
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
  } else if (phase === "converge") {
    if (p.life > p.convDelay) {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      const spd = clamp(d * 0.065, 1, 22);
      p.vx += (dx/d)*spd*0.16; p.vy += (dy/d)*spd*0.16;
      p.vx *= 0.87; p.vy *= 0.87;
      p.x += p.vx; p.y += p.vy;
      p.a = lerp(p.a, p.ma, 0.055);
    }
  } else if (phase === "orbit") {
    p.orA += p.orSpd;
    const j = Math.sin(p.life * 0.028 + p.noiseO) * 5;
    p.tx = CX + Math.cos(p.orA) * (p.orR + j);
    p.ty = CY + Math.sin(p.orA) * (p.orR + j);
    p.x = lerp(p.x, p.tx, 0.11); p.y = lerp(p.y, p.ty, 0.11);
    p.a = lerp(p.a, p.ma * (0.65 + 0.35 * Math.sin(p.pulse)), 0.04);
  } else {
    p.x += p.vx + Math.sin(p.life * 0.018 + p.noiseO) * 0.28;
    p.y += p.vy + Math.cos(p.life * 0.018 + p.noiseO) * 0.28;
    p.a = lerp(p.a, p.ma * 0.38, 0.018);
    if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
    if (p.y < -8) p.y = H + 8; if (p.y > H + 8) p.y = -8;
  }
  p.trail.unshift({ x:p.x, y:p.y, a:p.a });
  if (p.trail.length > p.tLen) p.trail.pop();
}

function drawParticle(ctx:CanvasRenderingContext2D, p:Particle) {
  if (p.a < 0.01) return;
  for (let i = 1; i < p.trail.length; i++) {
    const t = p.trail[i], ta = t.a * (1 - i / p.trail.length) * 0.4;
    ctx.beginPath(); ctx.arc(t.x, t.y, p.r * (1 - i / p.trail.length), 0, PI2);
    ctx.fillStyle = p.col + hex2(ta); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI2);
  ctx.fillStyle = p.col + hex2(p.a); ctx.fill();
  if (p.r > 1.6) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.8, 0, PI2);
    ctx.fillStyle = p.col + "16"; ctx.fill();
  }
}

function drawConnections(ctx:CanvasRenderingContext2D, parts:Particle[], maxD:number, ba:number) {
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx*dx + dy*dy);
      if (d < maxD) {
        const alpha = ba * (1 - d / maxD) * Math.min(a.a, b.a);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(124,58,237,${alpha})`; ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
  }
}

function drawCenterGlow(ctx:CanvasRenderingContext2D, CX:number, CY:number, W:number, H:number, alpha:number) {
  if (alpha < 0.01) return;
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 250);
  g.addColorStop(0,    `rgba(124,58,237,${alpha*0.38})`);
  g.addColorStop(0.45, `rgba(6,182,212,${alpha*0.14})`);
  g.addColorStop(0.75, `rgba(236,72,153,${alpha*0.07})`);
  g.addColorStop(1,    "transparent");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NexusIntro() {
  const bgRef  = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const fxRef  = useRef<HTMLCanvasElement>(null);

  // ── BUG FIX 2: Progress bar via imperative DOM ref, not React state ──────
  // setProgress(value) at 60fps caused React to re-render every frame,
  // which re-evaluated all JSX including the rand() calls in stream columns.
  // Writing directly to the DOM element skips React entirely for this one div.
  const progressBarRef = useRef<HTMLDivElement>(null);

  // React state — only for CSS transitions (rarely changes)
  const [logoVisible,    setLogoVisible]    = useState(false);
  const [orbitsVisible,  setOrbitsVisible]  = useState(false);
  const [accentFull,     setAccentFull]     = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [badgesVisible,  setBadgesVisible]  = useState(false);
  const [creatorVisible, setCreatorVisible] = useState(false);
  const [creatorBarFull, setCreatorBarFull] = useState(false);
  const [hexVisible,     setHexVisible]     = useState(false);
  const [dotsHidden,     setDotsHidden]     = useState(false);
  const [dismissed,      setDismissed]      = useState(false);

  // ── BUG FIX 4: Skip SSR to prevent hydration mismatch ─────────────────────
  // STREAM_COLS uses Math.random() at module scope. Server and client produce
  // different values → hydration mismatch on every style prop (top, left, etc.).
  // useSyncExternalStore returns false on server, true on client — React handles
  // this transition without hydration warnings. No setState-in-effect needed.
  const isClient = useIsClient();

  const stateRef = useRef({
    frame:0, phase:"drift" as Phase, cgAlpha:0, done:false,
    parts:[] as Particle[], stars:[] as Star[],
    sw:[] as Shockwave[], rays:[] as Ray[],
    W:0, H:0, CX:0, CY:0, rafId:0, lt:0, acc:0,
  });

  useEffect(() => {
    if (!isClient) return;

    // ── BUG FIX 3: Session check — read sessionStorage synchronously ─────────
    // If the intro was already shown this session, mark the ref and bail out.
    // We use a ref (not setState) to avoid the "setState in effect" lint rule.
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(SESSION_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external sessionStorage
        setDismissed(true);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "1");
    }

    const bgC  = bgRef.current;
    const midC = midRef.current;
    const fxC  = fxRef.current;
    if (!bgC || !midC || !fxC) return;

    const bgX  = bgC.getContext("2d")!;
    const midX = midC.getContext("2d")!;
    const fxX  = fxC.getContext("2d")!;
    const st   = stateRef.current;

    function resize() {
      st.W  = bgC!.width  = midC!.width  = fxC!.width  = window.innerWidth;
      st.H  = bgC!.height = midC!.height = fxC!.height = window.innerHeight;
      st.CX = st.W / 2; st.CY = st.H / 2;
      st.stars = buildStars(st.W, st.H);
    }
    resize();
    window.addEventListener("resize", resize);

    st.parts = Array.from({ length: 200 }, () => newParticle(st.W, st.H, st.CX, st.CY));

    function setPhase(ph: Phase) {
      st.phase = ph;
      if (ph === "converge") {
        st.parts.forEach(p => {
          const ang = rand(0, PI2), d = rand(8, 55);
          p.tx = st.CX + Math.cos(ang) * d;
          p.ty = st.CY + Math.sin(ang) * d;
          p.convDelay = rand(0, 100);
          p.life = 0;
        });
      } else if (ph === "orbit") {
        st.parts.forEach(p => {
          p.orR = rand(90, Math.min(st.W, st.H) * 0.36);
          p.orA = rand(0, PI2);
        });
      }
    }

    function triggerFlash(intensity = 0.7) {
      const f = document.getElementById("ni-flash");
      if (!f) return;
      f.style.transition = "opacity .07s ease";
      f.style.opacity = String(intensity);
      setTimeout(() => { f.style.transition = "opacity .7s ease"; f.style.opacity = "0"; }, 70);
    }

    const TL: Array<{ at:number; fn:()=>void }> = [
      { at: 28,  fn: () => setHexVisible(true) },
      { at: 105, fn: () => setPhase("converge") },
      { at: 168, fn: () => {
        setLogoVisible(true);
        triggerFlash(0.55);
        st.sw.push({ x:st.CX, y:st.CY, r:2, col:"#7C3AED", a:0.85, spd:14 });
        st.sw.push({ x:st.CX, y:st.CY, r:2, col:"#06B6D4", a:0.85, spd:10 });
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * PI2 + rand(-0.15, 0.15);
          st.rays.push({ x:st.CX, y:st.CY, ang, len:0, maxLen:rand(160,500),
            a:0.85, spd:rand(14,32), col:PAL[ri(0,PAL.length-1)], w:rand(0.8,3) });
        }
        setTimeout(() => setOrbitsVisible(true),  600);
        setTimeout(() => setAccentFull(true),      700);
        setDotsHidden(true);
      }},
      { at: 210, fn: () => setPhase("orbit") },
      { at: 260, fn: () => setTaglineVisible(true) },
      { at: 300, fn: () => setMetricsVisible(true) },
      { at: 340, fn: () => setBadgesVisible(true) },
      { at: 390, fn: () => {
        st.sw.push({ x:st.CX, y:st.CY, r:2, col:"#EC4899", a:0.85, spd:12 });
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * PI2 + rand(-0.15, 0.15);
          st.rays.push({ x:st.CX, y:st.CY, ang, len:0, maxLen:rand(160,500),
            a:0.85, spd:rand(14,32), col:PAL[ri(0,PAL.length-1)], w:rand(0.8,3) });
        }
      }},
      { at: 440, fn: () => {
        setCreatorVisible(true);
        setTimeout(() => setCreatorBarFull(true), 400);
      }},
      { at: 560, fn: () => setPhase("ambient") },
      { at: 690, fn: () => {
        if (!st.done) { st.done = true; triggerFlash(0.25); }
      }},
    ];

    const FPS = 1000 / 60;

    function tick() {
      const { W, H, CX, CY } = st;
      st.frame++;
      for (const e of TL) if (e.at === st.frame) e.fn();
      if (st.frame > 168) st.cgAlpha = Math.min(st.cgAlpha + 0.012, 1);

      // Write progress directly to DOM — no React re-render triggered
      if (progressBarRef.current) {
        progressBarRef.current.style.width =
          `${Math.min((st.frame / TOTAL_FRAMES) * 100, 100)}%`;
      }

      drawStars(bgX, st.stars, W, H);

      midX.clearRect(0, 0, W, H);
      drawCenterGlow(midX, CX, CY, W, H, st.cgAlpha);
      drawConnections(midX, st.parts.filter(p => p.a > 0.18), 130, 0.45);
      for (const p of st.parts) {
        updateParticle(p, st.phase, CX, CY, W, H);
        drawParticle(midX, p);
      }

      fxX.clearRect(0, 0, W, H);
      tickShockwaves(fxX, st.sw);
      tickRays(fxX, st.rays);
    }

    function loop(ts: number) {
      st.acc += ts - st.lt; st.lt = ts;
      while (st.acc >= FPS) { tick(); st.acc -= FPS; }
      st.rafId = requestAnimationFrame(loop);
    }

    function onMouseMove(e: MouseEvent) {
      if (st.phase === "converge") return;
      const mx = e.clientX, my = e.clientY;
      for (const p of st.parts) {
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) { p.vx += (dx/d)*1.8; p.vy += (dy/d)*1.8; }
      }
    }
    window.addEventListener("mousemove", onMouseMove);

    st.rafId = requestAnimationFrame(ts => { st.lt = ts; loop(ts); });

    return () => {
      cancelAnimationFrame(st.rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [isClient]);

  function skipIntro() {
    const st = stateRef.current;
    st.frame = TOTAL_FRAMES; st.done = true; st.cgAlpha = 1;
    setLogoVisible(true); setOrbitsVisible(true); setAccentFull(true);
    setTaglineVisible(true); setMetricsVisible(true); setBadgesVisible(true);
    setCreatorVisible(true); setCreatorBarFull(true);
    setHexVisible(true); setDotsHidden(true);
    if (progressBarRef.current) progressBarRef.current.style.width = "100%";
    st.parts.forEach(p => {
      p.orR = rand(90, Math.min(st.W, st.H) * 0.36);
      p.orA = rand(0, PI2);
    });
    st.phase = "ambient";
  }

  // Early return AFTER all hooks (Rules of Hooks)
  // !isClient → server render returns null → no hydration mismatch
  if (!isClient || dismissed) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden select-none"
      style={{ zIndex:9999, background:"#060609", cursor:"none", fontFamily:"'Rajdhani', sans-serif" }}
    >
      {/* Canvases */}
      <canvas ref={bgRef}  className="fixed inset-0 pointer-events-none" style={{ zIndex:1 }} />
      <canvas ref={midRef} className="fixed inset-0 pointer-events-none" style={{ zIndex:2 }} />
      <canvas ref={fxRef}  className="fixed inset-0 pointer-events-none" style={{ zIndex:3 }} />

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        zIndex:1,
        background:[
          "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(124,58,237,.14) 0, transparent 70%)",
          "radial-gradient(ellipse 35% 25% at 20% 25%, rgba(6,182,212,.07) 0, transparent 60%)",
          "radial-gradient(ellipse 35% 25% at 80% 75%, rgba(236,72,153,.07) 0, transparent 60%)",
        ].join(", "),
      }} />

      {/* Hex grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        zIndex:2,
        opacity: hexVisible ? 0.55 : 0,
        transition:"opacity 0.8s ease",
        backgroundImage:[
          "repeating-linear-gradient(60deg, rgba(124,58,237,.035) 0, rgba(124,58,237,.035) 1px, transparent 0, transparent 50%)",
          "repeating-linear-gradient(120deg, rgba(6,182,212,.035) 0, rgba(6,182,212,.035) 1px, transparent 0, transparent 50%)",
        ].join(", "),
        backgroundSize:"60px 104px",
      }} />

      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none" style={{
        zIndex:9,
        background:"radial-gradient(ellipse at center, transparent 35%, rgba(6,6,9,.9) 100%)",
      }} />

      {/* Flash */}
      <div id="ni-flash" className="fixed inset-0 pointer-events-none"
        style={{ zIndex:50, background:"#fff", opacity:0 }} />

      {/* Data streams — stable because STREAM_COLS is module-level */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{
        zIndex:4,
        opacity: hexVisible ? 0.65 : 0,
        transition:"opacity 1s ease",
      }}>
        {STREAM_COLS.map((col, i) => (
          <div key={i} className="absolute" style={{
            top:-120, left:col.left,
            fontSize:10, fontWeight:300, letterSpacing:"0.18em",
            writingMode:"vertical-rl", color:col.color,
            animation:`ni-streamFall ${col.duration} ${col.delay} linear infinite`,
            opacity:0,
          }}>
            {col.words.map((w, j) => <span key={j} style={{ display:"block" }}>{w}</span>)}
          </div>
        ))}
      </div>

      {/* Top brand */}
      <div className="fixed" style={{
        top:26, left:34, zIndex:100,
        fontFamily:"'Orbitron', monospace", fontSize:13, fontWeight:700,
        letterSpacing:"0.32em", color:"rgba(255,255,255,.88)",
        opacity:0, animation:"ni-fadeIn 1s ease 2.5s forwards",
      }}>NEXUS</div>

      {/* Skip */}
      <button
        onClick={() => { skipIntro(); setTimeout(() => setDismissed(true), 600); }}
        style={{
          position:"fixed", top:26, right:34, zIndex:100,
          fontFamily:"'Rajdhani', sans-serif", fontSize:11, fontWeight:600,
          letterSpacing:"0.22em", textTransform:"uppercase",
          color:"rgba(255,255,255,.32)", background:"none",
          border:"1px solid rgba(255,255,255,.09)", borderRadius:4,
          padding:"7px 16px", cursor:"pointer",
          opacity:0, animation:"ni-fadeIn 1s ease 2.5s forwards",
        }}
        onMouseEnter={e => { e.currentTarget.style.color="rgba(255,255,255,.65)"; e.currentTarget.style.borderColor="rgba(255,255,255,.22)"; }}
        onMouseLeave={e => { e.currentTarget.style.color="rgba(255,255,255,.32)"; e.currentTarget.style.borderColor="rgba(255,255,255,.09)"; }}
      >Skip ›</button>

      {/* Loading dots */}
      <div className="fixed" style={{
        bottom:76, left:"50%", transform:"translateX(-50%)",
        zIndex:20, display:"flex", gap:9,
        opacity: dotsHidden ? 0 : undefined,
        transition:"opacity 0.5s ease",
        animation:"ni-fadeIn .5s ease .4s forwards",
      }}>
        {(["#06B6D4","#A855F7","#EC4899"] as const).map((bg, i) => (
          <div key={i} style={{
            width:5, height:5, borderRadius:"50%",
            background:bg, boxShadow:`0 0 10px ${bg}`,
            animation:`ni-dotBounce 1.3s ${["0s",".22s",".44s"][i]} ease-in-out infinite`,
          }} />
        ))}
      </div>

      {/* Stage */}
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex:10 }}>
        <div className="relative flex flex-col items-center justify-center text-center">

          {/* Logo ring */}
          <div className="relative flex items-center justify-center" style={{ width:360, height:360 }}>
            {/* Pulse rings */}
            {[
              { size:340, color:"rgba(124,58,237,.22)", delay:"0s"  },
              { size:295, color:"rgba(6,182,212,.18)",  delay:".5s" },
              { size:252, color:"rgba(236,72,153,.14)", delay:"1s"  },
            ].map((ring, i) => (
              <div key={i} className="absolute rounded-full" style={{
                width:ring.size, height:ring.size,
                border:`1px solid ${ring.color}`,
                animation:`ni-ringPulse 3.5s ${ring.delay} ease-in-out infinite`,
              }} />
            ))}

            {/* Orbit tracks */}
            {[
              { size:328, bT:"#06B6D4", bR:"rgba(6,182,212,.25)",  dotBg:"#06B6D4", dsz:8, dur:"9s",  fwd:true,  topDot:true  },
              { size:270, bT:"#EC4899", bR:"rgba(236,72,153,.25)", dotBg:"#EC4899", dsz:7, dur:"14s", fwd:false, topDot:true  },
              { size:310, bB:"#A855F7", bL:"rgba(168,85,247,.2)",  dotBg:"#A855F7", dsz:6, dur:"20s", fwd:true,  topDot:false },
            ].map((ot, i) => (
              <div key={i} className="absolute rounded-full" style={{
                width:ot.size, height:ot.size,
                border:"1px solid transparent",
                borderTopColor:    ot.bT ?? "transparent",
                borderRightColor:  ot.bR ?? "transparent",
                borderBottomColor: ot.bB ?? "transparent",
                borderLeftColor:   ot.bL ?? "transparent",
                opacity: orbitsVisible ? 1 : 0,
                transition:"opacity 1s ease",
                animation:`${ot.fwd ? "ni-spinFwd" : "ni-spinRev"} ${ot.dur} linear infinite`,
              }}>
                <div style={{
                  position:"absolute", borderRadius:"50%",
                  ...(ot.topDot
                    ? { top:-4, left:"50%", transform:"translateX(-50%)" }
                    : { bottom:-4, left:"50%", transform:"translateX(-50%)" }),
                  width:ot.dsz, height:ot.dsz,
                  background:ot.dotBg,
                  boxShadow:`0 0 ${ot.dsz*2}px ${ot.dotBg}, 0 0 ${ot.dsz*4}px ${ot.dotBg}`,
                }} />
              </div>
            ))}

            {/* NEXUS text */}
            <div style={{ position:"relative", display:"inline-block" }}>
              <div style={{
                fontFamily:"'Orbitron', monospace", fontWeight:900,
                fontSize:"clamp(68px, 11vw, 128px)", letterSpacing:"0.14em", lineHeight:1,
                opacity: logoVisible ? 1 : 0,
                transform: logoVisible ? "scale(1) translateY(0)" : "scale(.82) translateY(10px)",
                transition:"opacity .9s cubic-bezier(.4,0,.2,1), transform .9s cubic-bezier(.4,0,.2,1)",
                userSelect:"none", whiteSpace:"nowrap",
              }}>
                {"NEXUS".split("").map((ch, i) => (
                  <span key={i} style={{
                    display:"inline-block",
                    background:"linear-gradient(140deg, #fff 0%, #c4b5fd 20%, #A855F7 40%, #06B6D4 65%, #EC4899 100%)",
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                    filter:"drop-shadow(0 0 28px rgba(124,58,237,.95)) drop-shadow(0 0 60px rgba(6,182,212,.5))",
                    animation:`ni-charFloat 4s ${(i*0.1).toFixed(1)}s ease-in-out infinite`,
                  }}>{ch}</span>
                ))}
              </div>

              {/* Glitch layers (real divs, since pseudo-elements can't be animated in React) */}
              {logoVisible && <>
                <div aria-hidden="true" style={{
                  position:"absolute", top:0, left:0, pointerEvents:"none",
                  fontFamily:"'Orbitron', monospace", fontWeight:900,
                  fontSize:"clamp(68px, 11vw, 128px)", letterSpacing:"0.14em", lineHeight:1,
                  color:"#06B6D4", WebkitTextFillColor:"#06B6D4", whiteSpace:"nowrap",
                  clipPath:"polygon(0 25%, 100% 25%, 100% 45%, 0 45%)",
                  animation:"ni-glitchA 7s infinite",
                }}>NEXUS</div>
                <div aria-hidden="true" style={{
                  position:"absolute", top:0, left:0, pointerEvents:"none",
                  fontFamily:"'Orbitron', monospace", fontWeight:900,
                  fontSize:"clamp(68px, 11vw, 128px)", letterSpacing:"0.14em", lineHeight:1,
                  color:"#EC4899", WebkitTextFillColor:"#EC4899", whiteSpace:"nowrap",
                  clipPath:"polygon(0 60%, 100% 60%, 100% 78%, 0 78%)",
                  animation:"ni-glitchB 7s infinite",
                }}>NEXUS</div>
              </>}

              {/* Scan line */}
              {logoVisible && (
                <div style={{
                  position:"absolute", width:"110%", height:2, left:"-5%", top:0,
                  background:"linear-gradient(90deg, transparent 0%, rgba(6,182,212,.2) 10%, #06B6D4 50%, rgba(6,182,212,.2) 90%, transparent 100%)",
                  boxShadow:"0 0 20px #06B6D4, 0 0 40px rgba(6,182,212,.4)",
                  animation:"ni-scan 3.5s ease-in-out 5s infinite",
                }} />
              )}
            </div>
          </div>

          {/* Accent underline */}
          <div style={{
            height:2, margin:"0.5rem auto 0",
            width: accentFull ? "80%" : "0%",
            transition:"width 1.4s cubic-bezier(.4,0,.2,1)",
            background:"linear-gradient(90deg, transparent, #7C3AED, #06B6D4, #EC4899, transparent)",
            boxShadow:"0 0 12px #06B6D4, 0 0 24px rgba(6,182,212,.3)",
          }} />

          {/* Tagline */}
          <div style={{
            fontFamily:"'Rajdhani', sans-serif", fontWeight:300,
            fontSize:"clamp(11px, 1.6vw, 16px)", letterSpacing:"0.55em",
            textTransform:"uppercase", color:"rgba(248,250,252,.45)",
            marginTop:14,
            opacity: taglineVisible ? 1 : 0,
            transform: taglineVisible ? "translateY(0)" : "translateY(8px)",
            transition:"opacity 1.2s ease, transform 1.2s ease",
          }}>Project Intelligence Platform</div>

          {/* Metrics */}
          <div style={{
            display:"flex", gap:32, marginTop:20,
            opacity: metricsVisible ? 1 : 0,
            transform: metricsVisible ? "translateY(0)" : "translateY(12px)",
            transition:"opacity 1.2s ease, transform 1.2s ease",
          }}>
            {[
              { val:"1,345",     lbl:"Tests"         },
              { val:"30+",       lbl:"Technologies"  },
              { val:"Multi",     lbl:"Tenant"        },
              { val:"Real-time", lbl:"Collaboration" },
            ].map(({ val, lbl }) => (
              <div key={lbl} style={{ textAlign:"center" }}>
                <div style={{
                  fontFamily:"'Orbitron', monospace",
                  fontSize:"clamp(14px, 2.2vw, 22px)", fontWeight:700,
                  background:"linear-gradient(135deg, #06B6D4, #A855F7)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                }}>{val}</div>
                <div style={{
                  fontFamily:"'Rajdhani', sans-serif", fontSize:10, fontWeight:400,
                  letterSpacing:"0.3em", textTransform:"uppercase",
                  color:"rgba(248,250,252,.3)", marginTop:2,
                }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech badges */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex:8 }}>
        {STACK.map((t, i) => {
          const pos = BADGE_POS[i % BADGE_POS.length];
          return (
            <div key={t.n} style={{
              position:"absolute", left:pos.l, top:pos.t,
              fontFamily:"'Rajdhani', monospace", fontSize:10.5, fontWeight:600,
              letterSpacing:"0.1em", padding:"4px 11px", borderRadius:4,
              whiteSpace:"nowrap", color:t.c, background:t.bg,
              border:`1px solid ${t.bd}`,
              boxShadow:`0 0 14px ${t.c}1a, inset 0 0 8px ${t.c}08`,
              backdropFilter:"blur(10px)",
              opacity: badgesVisible ? 1 : 0,
              transform: badgesVisible ? "translateY(0)" : "translateY(8px)",
              transition:`opacity .6s ${i*70}ms ease, transform .6s ${i*70}ms ease`,
            }}>
              <span style={{ opacity:0.45, fontSize:8 }}>&#9658; </span>{t.n}
            </div>
          );
        })}
      </div>

      {/* Creator */}
      <div className="fixed" style={{
        bottom:44, left:"50%", transform:"translateX(-50%)",
        zIndex:20, textAlign:"center",
        opacity: creatorVisible ? 1 : 0,
        transition:"opacity 1.5s ease",
      }}>
        <div style={{
          fontFamily:"'Inter', sans-serif", fontWeight:300, fontSize:10,
          letterSpacing:"0.4em", textTransform:"uppercase",
          color:"rgba(248,250,252,.3)", marginBottom:5,
        }}>Crafted by</div>
        <div style={{
          fontFamily:"'Rajdhani', sans-serif", fontWeight:700,
          fontSize:"clamp(17px, 2.8vw, 26px)", letterSpacing:"0.22em",
          textTransform:"uppercase",
          background:"linear-gradient(90deg, #F59E0B 0%, #FFF8DC 40%, #FFC859 70%, #F59E0B 100%)",
          backgroundSize:"200%",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          filter:"drop-shadow(0 0 18px rgba(245,158,11,.65))",
          animation:"ni-goldShimmer 2.8s ease-in-out infinite",
        }}>Viraj Pankaj Jain</div>
        <div style={{
          height:1, margin:"8px auto 0",
          width: creatorBarFull ? "100%" : "0%",
          transition:"width 1.6s cubic-bezier(.4,0,.2,1)",
          background:"linear-gradient(90deg, transparent, #F59E0B, transparent)",
          boxShadow:"0 0 10px #F59E0B",
        }} />
      </div>

      {/* Progress bar — written imperatively, never triggers re-render */}
      <div ref={progressBarRef} className="fixed bottom-0 left-0" style={{
        height:2, zIndex:100, width:"0%",
        transition:"width .1s linear",
        background:"linear-gradient(90deg, #7C3AED, #06B6D4, #EC4899)",
        boxShadow:"0 0 8px #06B6D4",
      }} />

      {/* Keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500&display=swap');
        @keyframes ni-streamFall {
          from { transform:translateY(-120px); opacity:0; }
          10%  { opacity:.9; }
          85%  { opacity:.3; }
          to   { transform:translateY(110vh); opacity:0; }
        }
        @keyframes ni-ringPulse {
          0%,100% { opacity:.35; transform:scale(1);    }
          50%     { opacity:1;   transform:scale(1.04); }
        }
        @keyframes ni-spinFwd { to { transform:rotate(360deg);  } }
        @keyframes ni-spinRev { to { transform:rotate(-360deg); } }
        @keyframes ni-charFloat {
          0%,100% { transform:translateY(0);   }
          50%     { transform:translateY(-7px); }
        }
        @keyframes ni-glitchA {
          0%,93%,100% { opacity:0;   transform:translateX(0);   }
          94%         { opacity:.85; transform:translateX(-5px); }
          95%         { opacity:0;   transform:translateX(5px);  }
          96%         { opacity:.55; transform:translateX(-3px); }
          97%         { opacity:0; }
        }
        @keyframes ni-glitchB {
          0%,91%,100% { opacity:0;  transform:translateX(0);   }
          92%         { opacity:.7; transform:translateX(5px);  }
          93%         { opacity:0;  transform:translateX(-4px); }
          94%         { opacity:.4; transform:translateX(3px);  }
          95%         { opacity:0; }
        }
        @keyframes ni-scan {
          0%  { top:-5%;  opacity:0; }
          8%  { opacity:1; }
          92% { opacity:.8; }
          100%{ top:110%; opacity:0; }
        }
        @keyframes ni-dotBounce {
          0%,100% { transform:translateY(0);   opacity:.4; }
          50%     { transform:translateY(-9px); opacity:1;  }
        }
        @keyframes ni-fadeIn { to { opacity:1; } }
        @keyframes ni-goldShimmer {
          0%,100% { background-position:0%;   }
          50%     { background-position:100%; }
        }
      `}</style>
    </div>
  );
}