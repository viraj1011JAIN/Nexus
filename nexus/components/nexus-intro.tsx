"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:      "#07070f",
  purple:  "#7c3aed",
  violet:  "#8b5cf6",
  cyan:    "#06b6d4",
  pink:    "#ec4899",
  magenta: "#d946ef",
  indigo:  "#6366f1",
  blue:    "#3b82f6",
} as const;

const PARTICLE_PALETTE = [
  C.purple, C.violet, C.magenta, C.pink, C.cyan, C.indigo, C.blue,
  "#a78bfa", "#c084fc", "#e879f9", "#60a5fa", "#67e8f9", "#f472b6", "#818cf8",
];

const LETTERS      = ["N", "E", "X", "U", "S"] as const;
const SESSION_KEY  = "nexus_intro_v2";
const SHOW_MS      = 3200;

const LETTER_GRADIENTS = [
  "linear-gradient(155deg,#fff 0%,#ddd6fe 18%,#a78bfa 44%,#7c3aed 70%,#4c1d95 100%)",
  "linear-gradient(155deg,#fff 0%,#e0e7ff 18%,#a5b4fc 44%,#6366f1 70%,#3730a3 100%)",
  "linear-gradient(155deg,#fce7f3 0%,#f9a8d4 18%,#ec4899 40%,#d946ef 65%,#7c3aed 100%)",
  "linear-gradient(155deg,#ecfeff 0%,#a5f3fc 18%,#22d3ee 44%,#06b6d4 70%,#0e7490 100%)",
  "linear-gradient(155deg,#fff 0%,#ddd6fe 18%,#a78bfa 44%,#8b5cf6 70%,#5b21b6 100%)",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number; y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  tx: number; ty: number;
  opacity: number;
}

// ─── Web Audio synthesis ──────────────────────────────────────────────────────
function playSounds(): void {
  try {
    type WA = Window & { webkitAudioContext?: typeof AudioContext };
    const AC = (window as WA).webkitAudioContext ?? AudioContext;
    if (!AC) return;
    const ctx = new AC();
    ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.4, ctx.currentTime);
    master.connect(ctx.destination);
    const now = ctx.currentTime;

    // Bass drone
    const bass = ctx.createOscillator();
    const bassG = ctx.createGain();
    bass.type = "sine";
    bass.frequency.setValueAtTime(55, now);
    bass.frequency.linearRampToValueAtTime(36, now + 3.1);
    bassG.gain.setValueAtTime(0, now);
    bassG.gain.linearRampToValueAtTime(0.5, now + 0.38);
    bassG.gain.setValueAtTime(0.5, now + 2.5);
    bassG.gain.exponentialRampToValueAtTime(0.001, now + 3.1);
    bass.connect(bassG); bassG.connect(master);
    bass.start(now); bass.stop(now + 3.2);

    // Letter impact ticks
    for (let i = 0; i < 5; i++) {
      const t = now + 0.45 + i * 0.14;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(420 - i * 22, t);
      o.frequency.exponentialRampToValueAtTime(88, t + 0.18);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.22);
    }

    // Glitch burst — highpass white noise
    const tG = now + 1.28;
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const gn = ctx.createBufferSource(); gn.buffer = nb;
    const gnF = ctx.createBiquadFilter(); gnF.type = "highpass"; gnF.frequency.setValueAtTime(2400, tG);
    const gnG = ctx.createGain();
    gnG.gain.setValueAtTime(0.28, tG);
    gnG.gain.exponentialRampToValueAtTime(0.001, tG + 0.08);
    gn.connect(gnF); gnF.connect(gnG); gnG.connect(master);
    gn.start(tG); gn.stop(tG + 0.1);

    // Beam whoosh — bandpass noise + sawtooth sweep
    const tB = now + 1.45;
    const wb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.55), ctx.sampleRate);
    const wd = wb.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    const bn = ctx.createBufferSource(); bn.buffer = wb;
    const bF = ctx.createBiquadFilter(); bF.type = "bandpass";
    bF.frequency.setValueAtTime(500, tB);
    bF.frequency.exponentialRampToValueAtTime(4200, tB + 0.13);
    bF.frequency.exponentialRampToValueAtTime(250,  tB + 0.46);
    bF.Q.setValueAtTime(1.2, tB);
    const bG = ctx.createGain();
    bG.gain.setValueAtTime(0, tB - 0.01);
    bG.gain.linearRampToValueAtTime(0.9, tB + 0.06);
    bG.gain.exponentialRampToValueAtTime(0.001, tB + 0.5);
    bn.connect(bF); bF.connect(bG); bG.connect(master);
    bn.start(tB); bn.stop(tB + 0.55);

    const sw = ctx.createOscillator(); sw.type = "sawtooth";
    const swG = ctx.createGain();
    sw.frequency.setValueAtTime(95, tB);
    sw.frequency.exponentialRampToValueAtTime(3400, tB + 0.12);
    sw.frequency.exponentialRampToValueAtTime(55,   tB + 0.42);
    swG.gain.setValueAtTime(0, tB - 0.01);
    swG.gain.linearRampToValueAtTime(0.35, tB + 0.04);
    swG.gain.exponentialRampToValueAtTime(0.001, tB + 0.44);
    sw.connect(swG); swG.connect(master);
    sw.start(tB); sw.stop(tB + 0.48);

    // Impact ring harmonics
    const tR = now + 1.58;
    ([880, 1320, 1760] as const).forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = "sine";
      const g = ctx.createGain();
      o.frequency.setValueAtTime(freq, tR + i * 0.02);
      g.gain.setValueAtTime(0.14 - i * 0.03, tR + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, tR + 1.35);
      o.connect(g); g.connect(master);
      o.start(tR + i * 0.02); o.stop(tR + 1.4);
    });
  } catch {
    // Web Audio not available — silent fail
  }
}

// ─── Particle factory ─────────────────────────────────────────────────────────
function buildParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.random() * 24 + 6;
    return {
      id:       i,
      x:        47 + (Math.random() - 0.5) * 30,
      y:        45 + (Math.random() - 0.5) * 18,
      size:     Math.random() * 4.8 + 1.2,
      color:    PARTICLE_PALETTE[i % PARTICLE_PALETTE.length],
      delay:    Math.random() * 0.28 + 1.56,
      duration: Math.random() * 1.6 + 1.0,
      tx:       Math.cos(angle) * dist,
      ty:       Math.sin(angle) * dist,
      opacity:  Math.random() * 0.75 + 0.25,
    };
  });
}

// ─── Corner bracket config ────────────────────────────────────────────────────
const CORNERS: Array<{
  pos: React.CSSProperties;
  borders: React.CSSProperties;
  delay: number;
}> = [
  { pos: { top: 24, left: 24 },     borders: { borderTop: "1.5px solid", borderLeft: "1.5px solid" },    delay: 0.22 },
  { pos: { top: 24, right: 24 },    borders: { borderTop: "1.5px solid", borderRight: "1.5px solid" },   delay: 0.27 },
  { pos: { bottom: 24, left: 24 },  borders: { borderBottom: "1.5px solid", borderLeft: "1.5px solid" }, delay: 0.32 },
  { pos: { bottom: 24, right: 24 }, borders: { borderBottom: "1.5px solid", borderRight: "1.5px solid" },delay: 0.37 },
];

const TAGLINE = "Project Management, Elevated";

// ─── Component ────────────────────────────────────────────────────────────────
export function NexusIntro() {
  const [visible,   setVisible]   = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [glitch,    setGlitch]    = useState(false);
  const [showGlow,  setShowGlow]  = useState(false);
  const audioFiredRef             = useRef(false);
  const shouldReduce              = useReducedMotion();

  useEffect(() => {
    if (shouldReduce) return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    // setTimeout 0 satisfies react-hooks/set-state-in-effect
    setTimeout(() => {
      setParticles(buildParticles(60));
      setVisible(true);
    }, 0);

    if (!audioFiredRef.current) {
      audioFiredRef.current = true;
      playSounds();
    }

    const g1on  = setTimeout(() => setGlitch(true),   1280);
    const g1off = setTimeout(() => setGlitch(false),  1355);
    const g2on  = setTimeout(() => setGlitch(true),   1385);
    const g2off = setTimeout(() => setGlitch(false),  1445);
    const glow  = setTimeout(() => setShowGlow(true), 1680);
    const exit  = setTimeout(() => setVisible(false), SHOW_MS);

    return () => [g1on, g1off, g2on, g2off, glow, exit].forEach(clearTimeout);
  }, [shouldReduce]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nexus-intro-v2"
          aria-hidden="true"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ backgroundColor: C.bg }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.6, 1] }}
        >
          {/* ── Mesh gradient background ── */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0 }}
            style={{
              background: [
                "radial-gradient(ellipse 80% 55% at 18% 18%, rgba(124,58,237,0.22) 0%, transparent 60%)",
                "radial-gradient(ellipse 65% 50% at 85% 12%, rgba(59,130,246,0.14) 0%, transparent 55%)",
                "radial-gradient(ellipse 55% 62% at 50% 90%, rgba(217,70,239,0.18) 0%, transparent 55%)",
                "radial-gradient(ellipse 75% 52% at 72% 68%, rgba(6,182,212,0.10) 0%, transparent 58%)",
              ].join(", "),
            }}
          />

          {/* ── Breathing depth orbs ── */}
          {([
            { s: { top: "4%",    left: "8%",   width: 720, height: 720 } as React.CSSProperties, color: "rgba(124,58,237,0.13)", d: 4.8, delay: 0   },
            { s: { bottom: "2%", right: "6%",  width: 600, height: 600 } as React.CSSProperties, color: "rgba(217,70,239,0.10)", d: 5.5, delay: 1.2 },
            { s: { top: "28%",   right: "12%", width: 420, height: 420 } as React.CSSProperties, color: "rgba(6,182,212,0.09)",  d: 3.6, delay: 0.7 },
            { s: { bottom: "22%",left: "14%",  width: 340, height: 340 } as React.CSSProperties, color: "rgba(59,130,246,0.10)", d: 4.2, delay: 2.1 },
          ]).map(({ s, color, d, delay }, i) => (
            <motion.div
              key={`orb-${i}`}
              className="absolute pointer-events-none rounded-full"
              style={{
                ...s,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                filter: "blur(50px)",
              }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.55, 1, 0.55] }}
              transition={{ duration: d, repeat: Infinity, ease: "easeInOut", delay }}
            />
          ))}

          {/* ── Holographic grid ── */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.07, 0.035] }}
            transition={{ delay: 0.2, duration: 1.8, times: [0, 0.3, 1] }}
            style={{
              backgroundImage: [
                "linear-gradient(rgba(139,92,246,0.45) 1px, transparent 1px)",
                "linear-gradient(90deg, rgba(139,92,246,0.45) 1px, transparent 1px)",
              ].join(", "),
              backgroundSize: "88px 88px",
            }}
          />

          {/* ── Scan-line sweep ── */}
          <motion.div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              height: 2,
              background: `linear-gradient(90deg, transparent 0%, ${C.cyan} 20%, ${C.magenta} 50%, ${C.purple} 80%, transparent 100%)`,
              boxShadow: `0 0 18px 4px rgba(6,182,212,0.5), 0 0 40px 10px rgba(217,70,239,0.2)`,
            }}
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: "102%", opacity: [0, 0.9, 0.9, 0] }}
            transition={{ delay: 0.15, duration: 1.9, ease: "linear" }}
          />

          {/* ── 60 particles ── */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                width: p.size, height: p.size,
                background: p.color,
                boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${p.color}66`,
              }}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, p.opacity, p.opacity * 0.6, 0],
                x: ["0vw", `${p.tx}vw`],
                y: ["0vh", `${p.ty}vh`],
              }}
              transition={{ delay: p.delay, duration: p.duration, ease: "easeOut" }}
            />
          ))}

          {/* ── Corner brackets ── */}
          {CORNERS.map((c, i) => (
            <motion.div
              key={`cn-${i}`}
              className="absolute pointer-events-none"
              style={{ width: 34, height: 34, ...c.pos, ...c.borders, borderColor: "rgba(139,92,246,0.6)" }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: c.delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}

          {/* ── Corner glow dots ── */}
          {([
            { top: 22,    left: 22  } as React.CSSProperties,
            { top: 22,    right: 22 } as React.CSSProperties,
            { bottom: 22, left: 22  } as React.CSSProperties,
            { bottom: 22, right: 22 } as React.CSSProperties,
          ]).map((pos, i) => (
            <motion.div
              key={`cd-${i}`}
              className="absolute pointer-events-none rounded-full"
              style={{
                width: 5, height: 5,
                background: i % 2 === 0 ? C.violet : C.cyan,
                boxShadow: `0 0 10px 4px ${i % 2 === 0 ? "rgba(139,92,246,0.9)" : "rgba(6,182,212,0.9)"}`,
                ...pos,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1] }}
              transition={{ delay: 0.4 + i * 0.06, duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }}
            />
          ))}

          {/* ── Main stage ── */}
          <div className="relative flex flex-col items-center" style={{ gap: 22 }}>

            {/* Top accent line */}
            <motion.div
              style={{
                height: 1.5, width: 520, originX: 0.5,
                background: `linear-gradient(90deg, transparent, ${C.purple} 28%, ${C.magenta} 50%, ${C.cyan} 72%, transparent)`,
                boxShadow: `0 0 14px 2px rgba(124,58,237,0.55)`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* 3D block tilt */}
            <motion.div
              style={{ perspective: "900px" }}
              animate={{ rotateX: [0, 0, 6,  3,  0], rotateY: [0, 0, -4, -2, 0] }}
              transition={{ times: [0, 0.3, 0.56, 0.72, 1], duration: 2.8, delay: 0.38 }}
            >
              {/* Glitch wrapper */}
              <div
                style={{
                  filter:    glitch ? "hue-rotate(148deg) saturate(5) brightness(2.4) contrast(1.3)" : "none",
                  transform: glitch ? "translate3d(-3px,0,0)" : "none",
                  transition: glitch ? "none" : "filter 0.04s, transform 0.04s",
                  transformStyle: "preserve-3d" as const,
                }}
              >
                {/* Letters + beam layers */}
                <div className="relative flex items-center" style={{ gap: 5 }}>

                  {/* Letters */}
                  {LETTERS.map((letter, i) => (
                    <div key={`lw-${i}`} style={{ display: "inline-block", perspective: "340px" }}>
                      <motion.span
                        initial={{ opacity: 0, rotateY: -88, y: 22, filter: "blur(16px)" }}
                        animate={{ opacity: 1, rotateY: 0,   y: 0,  filter: "blur(0px)"  }}
                        transition={{ delay: 0.45 + i * 0.14, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          display: "inline-block",
                          transformStyle: "preserve-3d" as const,
                          fontFamily: "var(--font-playfair),'Playfair Display',serif",
                          fontSize: "clamp(62px, 10.5vw, 128px)",
                          fontWeight: 700,
                          letterSpacing: "0.16em",
                          lineHeight: 1,
                          background: LETTER_GRADIENTS[i],
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                          filter: showGlow
                            ? "drop-shadow(0 0 28px rgba(139,92,246,1)) drop-shadow(0 0 12px rgba(217,70,239,0.7))"
                            : "none",
                          transition: "filter 0.4s ease",
                        }}
                      >
                        {letter}
                      </motion.span>
                    </div>
                  ))}

                  {/* Red crosshair flash */}
                  <motion.div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: "50%", height: 1,
                      background: "rgba(239,68,68,0.65)",
                      boxShadow: "0 0 12px 2px rgba(239,68,68,0.5)",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.8, 0] }}
                    transition={{ delay: 1.33, duration: 0.14 }}
                  />

                  {/* Blue fringe beam */}
                  <motion.div
                    className="absolute top-[-6%] bottom-[-6%] pointer-events-none"
                    style={{
                      width: "24%",
                      mixBlendMode: "screen" as const,
                      background: "linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.5) 40%, rgba(96,165,250,0.75) 60%, transparent 100%)",
                    }}
                    initial={{ x: "-32%", opacity: 1 }}
                    animate={{ x: "560%", opacity: 0 }}
                    transition={{ delay: 1.43, duration: 0.38, ease: [0.18, 0, 0.82, 1] }}
                  />

                  {/* White main beam */}
                  <motion.div
                    className="absolute top-[-12%] bottom-[-12%] pointer-events-none"
                    style={{
                      width: "20%",
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 15%, rgba(255,255,255,0.99) 50%, rgba(255,255,255,0.55) 85%, transparent 100%)",
                      boxShadow: "0 0 60px 20px rgba(255,255,255,0.35)",
                    }}
                    initial={{ x: "-28%", opacity: 1 }}
                    animate={{ x: "590%", opacity: [1, 1, 0] }}
                    transition={{ delay: 1.45, duration: 0.35, ease: [0.18, 0, 0.82, 1] }}
                  />

                  {/* Red fringe beam */}
                  <motion.div
                    className="absolute top-[-6%] bottom-[-6%] pointer-events-none"
                    style={{
                      width: "16%",
                      mixBlendMode: "screen" as const,
                      background: "linear-gradient(90deg, transparent 0%, rgba(236,72,153,0.45) 45%, rgba(239,68,68,0.55) 65%, transparent 100%)",
                    }}
                    initial={{ x: "-18%", opacity: 1 }}
                    animate={{ x: "640%", opacity: 0 }}
                    transition={{ delay: 1.47, duration: 0.33, ease: [0.18, 0, 0.82, 1] }}
                  />

                  {/* Starburst pulse */}
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{ top: "50%", left: "50%", width: 0, height: 0, transform: "translate(-50%,-50%)" }}
                    animate={{
                      boxShadow: [
                        "0 0 0px 0px rgba(217,70,239,0.8), 0 0 0px 0px rgba(6,182,212,0.6)",
                        "0 0 80px 80px rgba(217,70,239,0.6), 0 0 120px 60px rgba(6,182,212,0.4)",
                        "0 0 0px 0px rgba(217,70,239,0), 0 0 0px 0px rgba(6,182,212,0)",
                      ],
                    }}
                    transition={{ delay: 1.78, duration: 0.65, ease: "easeOut" }}
                  />

                  {/* Blast ring 1 */}
                  <motion.div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                      border: `2px solid ${C.violet}`,
                      boxShadow: "0 0 20px 4px rgba(139,92,246,0.6)",
                    }}
                    initial={{ width: 0, height: 0, opacity: 0.95 }}
                    animate={{ width: 680, height: 200, opacity: 0 }}
                    transition={{ delay: 1.58, duration: 0.9, ease: "easeOut" }}
                  />

                  {/* Blast ring 2 */}
                  <motion.div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                      border: `1px solid ${C.cyan}`,
                      boxShadow: "0 0 14px 2px rgba(6,182,212,0.5)",
                    }}
                    initial={{ width: 0, height: 0, opacity: 0.8 }}
                    animate={{ width: 400, height: 130, opacity: 0 }}
                    transition={{ delay: 1.62, duration: 0.65, ease: "easeOut" }}
                  />

                  {/* Post-beam radial glow */}
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{
                      inset: -50,
                      filter: "blur(14px)",
                      background: "radial-gradient(ellipse 88% 68% at 50% 50%, rgba(124,58,237,0.55) 0%, rgba(217,70,239,0.28) 38%, rgba(6,182,212,0.18) 62%, transparent 75%)",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.55, 0] }}
                    transition={{ delay: 1.56, duration: 1.05, times: [0, 0.14, 0.5, 1] }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Bottom accent line */}
            <motion.div
              style={{
                height: 1.5, width: 520, originX: 0.5,
                background: `linear-gradient(90deg, transparent, ${C.indigo} 28%, ${C.blue} 50%, ${C.cyan} 72%, transparent)`,
                boxShadow: `0 0 12px 2px rgba(99,102,241,0.45)`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.52, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />

            {/* Tagline */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {TAGLINE.split("").map((char, i) => (
                <motion.span
                  key={`tl-${i}`}
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.38em",
                    textTransform: "uppercase",
                    color: "rgba(148,163,184,0.78)",
                    fontWeight: 300,
                    display: "inline-block",
                    fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif",
                  }}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.92 + i * 0.031, duration: 0.24, ease: "easeOut" }}
                >
                  {char === " " ? "\u00A0\u00A0" : char}
                </motion.span>
              ))}
            </div>

            {/* Badge row */}
            <motion.div
              style={{ display: "flex", alignItems: "center" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.22, duration: 0.55 }}
            >
              {(["v4.0", "Enterprise", "AI-Powered"] as const).map((label, i) => (
                <motion.span
                  key={label}
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: i === 1 ? "rgba(167,139,250,0.75)" : "rgba(100,116,139,0.5)",
                    fontFamily: "var(--font-dm-sans),monospace",
                    fontWeight: 400,
                    paddingLeft: i > 0 ? 18 : 0,
                    marginLeft:  i > 0 ? 18 : 0,
                    borderLeft:  i > 0 ? "1px solid rgba(100,116,139,0.22)" : "none",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.28 + i * 0.1, duration: 0.4 }}
                >
                  {label}
                </motion.span>
              ))}
            </motion.div>
          </div>

          {/* ── Progress bar ── */}
          <div
            className="absolute overflow-hidden rounded-full"
            style={{ bottom: 38, width: 196, height: 2, background: "rgba(255,255,255,0.06)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${C.purple} 0%, ${C.magenta} 35%, ${C.cyan} 65%, ${C.blue} 100%)`,
                boxShadow: "0 0 8px rgba(124,58,237,0.7)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.36, duration: (SHOW_MS - 360) / 1000, ease: "linear" }}
            />
          </div>

          {/* ── HUD coordinates ── */}
          {([
            { pos: { bottom: 32, left: 32  } as React.CSSProperties, text: "00.000 N" },
            { pos: { bottom: 32, right: 32 } as React.CSSProperties, text: "00.000 E" },
          ]).map(({ pos, text }) => (
            <motion.span
              key={text}
              className="absolute pointer-events-none"
              style={{ fontSize: 8, letterSpacing: "0.25em", color: "rgba(100,116,139,0.35)", fontFamily: "monospace", ...pos }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              {text}
            </motion.span>
          ))}

          {/* ── SYS.INIT label ── */}
          <motion.span
            className="absolute top-[26px] pointer-events-none"
            style={{ fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(100,116,139,0.35)", fontFamily: "monospace" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            SYS.INIT
          </motion.span>

          {/* ── CRT scan-lines ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px)" }}
          />

          {/* ── Vignette ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 88% 78% at 50% 50%, transparent 38%, rgba(7,7,15,0.72) 100%)" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
