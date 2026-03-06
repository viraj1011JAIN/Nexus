"use client";

/**
 * NexusIntro — full-screen brand splash animation shown once per browser session.
 *
 * Sequence (total ≈ 3.2 s):
 *   0.00 s  Dark screen fills viewport
 *   0.20 s  Corner bracket decorators fade in
 *   0.15 s  Top accent line draws from centre outward
 *   0.35–0.85 s  N · E · X · U · S stagger in (blur → sharp, scale 0.8 → 1)
 *   0.50 s  Bottom accent line draws
 *   1.25 s  ★ Beam sweep — sharp white flash races left → right (the Netflix moment)
 *   1.65 s  Radial glow pulse fades out from behind letters
 *   1.55 s  Tagline "PROJECT MANAGEMENT, ELEVATED." fades in
 *   2.60 s  Entire overlay fades out (exit: 0.65 s)
 *
 * Guards:
 *   - sessionStorage key prevents repeat within a browser session
 *   - useReducedMotion: skips the animation entirely if user prefers reduced motion
 *   - Server renders null — zero hydration mismatch
 */

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  /** Pre-computed upward travel distance (px, negative = up) */
  deltaY: number;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LETTERS = ["N", "E", "X", "U", "S"] as const;
const PARTICLE_COUNT = 34;
const SESSION_KEY = "nexus_intro_v1";

/** How long the overlay stays visible before the exit animation starts (ms) */
const SHOW_MS = 2600;
/** Duration of the fade-out exit animation (s) */
const EXIT_S = 0.65;

const PARTICLE_COLORS = [
  "rgba(167,139,250,0.9)",  // violet-400
  "rgba(139,92,246,0.8)",   // violet-500
  "rgba(99,102,241,0.85)",  // indigo-500
  "rgba(196,181,253,0.7)",  // violet-300
  "rgba(129,140,248,0.8)",  // indigo-400
  "rgba(224,231,255,0.45)", // indigo-100
];

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const letterVariants: Variants = {
  hidden: { opacity: 0, y: 48, filter: "blur(14px)", scale: 0.82 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      delay: 0.35 + i * 0.1,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const lineVariants: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: (delay: number) => ({
    scaleX: 1,
    opacity: 1,
    transition: { delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cornerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.55 },
  visible: (delay: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Corner Decorator Data ────────────────────────────────────────────────────

const CORNERS: Array<{
  style: React.CSSProperties;
  delay: number;
}> = [
  {
    style: { top: 28, left: 28, borderTop: "1px solid rgba(139,92,246,0.4)", borderLeft: "1px solid rgba(139,92,246,0.4)" },
    delay: 0.18,
  },
  {
    style: { top: 28, right: 28, borderTop: "1px solid rgba(139,92,246,0.4)", borderRight: "1px solid rgba(139,92,246,0.4)" },
    delay: 0.22,
  },
  {
    style: { bottom: 28, left: 28, borderBottom: "1px solid rgba(99,102,241,0.35)", borderLeft: "1px solid rgba(99,102,241,0.35)" },
    delay: 0.26,
  },
  {
    style: { bottom: 28, right: 28, borderBottom: "1px solid rgba(99,102,241,0.35)", borderRight: "1px solid rgba(99,102,241,0.35)" },
    delay: 0.30,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function NexusIntro() {
  const [mounted, setMounted]     = useState(false);
  const [visible, setVisible]     = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    setMounted(true);

    // Bail early: reduced motion preference or already shown this session
    if (shouldReduce) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return;
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");

    // Pre-compute all random values here (not during render) to prevent
    // stale-closure / re-render jitter and avoid hydration mismatches.
    const generated: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id:       i,
      x:        Math.random() * 100,
      y:        15 + Math.random() * 70,
      size:     Math.random() * 3.5 + 1,
      delay:    Math.random() * 2.8,
      duration: Math.random() * 3 + 2.5,
      opacity:  Math.random() * 0.55 + 0.15,
      deltaY:   -(55 + Math.random() * 90),
      color:    PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }));

    setParticles(generated);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shouldReduce]);

  // Render nothing on the server and on client until effect fires — zero hydration mismatch
  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nexus-intro"
          aria-hidden="true"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#0D0C14" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: EXIT_S, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* ── Background radial orbs ───────────────────────────────────── */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: "10%", left: "18%",
              width: 640, height: 640,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.95, 0.5] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute pointer-events-none"
            style={{
              bottom: "8%", right: "12%",
              width: 520, height: 520,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(67,56,202,0.14) 0%, transparent 70%)",
            }}
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Floating particles ───────────────────────────────────────── */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none rounded-full"
              style={{
                left:       `${p.x}%`,
                top:        `${p.y}%`,
                width:      p.size,
                height:     p.size,
                background: p.color,
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{
                opacity: [0, p.opacity, p.opacity * 0.6, 0],
                y:       [0, p.deltaY],
              }}
              transition={{
                delay:    p.delay,
                duration: p.duration,
                repeat:   Infinity,
                ease:     "easeOut",
              }}
            />
          ))}

          {/* ── Corner bracket decorators ─────────────────────────────────── */}
          {CORNERS.map((corner, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{ width: 28, height: 28, ...corner.style }}
              custom={corner.delay}
              variants={cornerVariants}
              initial="hidden"
              animate="visible"
            />
          ))}

          {/* ── Main stage ───────────────────────────────────────────────── */}
          <div
            className="relative flex flex-col items-center"
            style={{ gap: 20 }}
          >
            {/* Top accent line */}
            <motion.div
              className="origin-center"
              style={{
                height: 1,
                width: 400,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.85) 50%, transparent 100%)",
              }}
              custom={0.12}
              variants={lineVariants}
              initial="hidden"
              animate="visible"
            />

            {/* ── NEXUS letters + beam ──────────────────────────────────── */}
            <div
              className="relative flex items-center overflow-hidden"
              style={{ gap: 2 }}
            >
              {LETTERS.map((letter, i) => (
                <motion.span
                  key={`${letter}-${i}`}
                  custom={i}
                  variants={letterVariants}
                  initial="hidden"
                  animate="visible"
                  style={{
                    fontFamily:   "var(--font-playfair), 'Playfair Display', serif",
                    fontSize:     "clamp(68px, 11vw, 132px)",
                    fontWeight:   700,
                    letterSpacing:"0.16em",
                    lineHeight:   1,
                    // Violet → indigo gradient text
                    background:
                      "linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 25%, #a78bfa 55%, #818cf8 80%, #6366f1 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor:  "transparent",
                    backgroundClip:       "text",
                  }}
                >
                  {letter}
                </motion.span>
              ))}

              {/* ★ Beam sweep — the cinematic flash moment */}
              <motion.div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  width: "28%",
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.92) 45%, rgba(255,255,255,0.98) 50%, rgba(255,255,255,0.92) 55%, transparent 100%)",
                }}
                initial={{ x: "-30%", opacity: 0.95 }}
                animate={{ x: "520%", opacity: 0 }}
                transition={{
                  delay:    1.25,
                  duration: 0.42,
                  ease:     [0.2, 0, 0.8, 1],
                }}
              />

              {/* Post-beam radial glow pulse */}
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  inset: -24,
                  background:
                    "radial-gradient(ellipse 85% 65% at 50% 50%, rgba(139,92,246,0.5) 0%, rgba(99,102,241,0.25) 50%, transparent 75%)",
                  filter:       "blur(10px)",
                  borderRadius: 12,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0.5, 0] }}
                transition={{ delay: 1.62, duration: 0.95, ease: "easeOut" }}
              />

              {/* Subtle shimmer that lingers on the text */}
              <motion.div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  width: "60%",
                  left:  "20%",
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(196,181,253,0.12) 50%, transparent 100%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ delay: 1.65, duration: 0.8, ease: "easeOut" }}
              />
            </div>

            {/* Bottom accent line */}
            <motion.div
              className="origin-center"
              style={{
                height: 1,
                width: 400,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.65) 50%, transparent 100%)",
              }}
              custom={0.48}
              variants={lineVariants}
              initial="hidden"
              animate="visible"
            />

            {/* Tagline */}
            <motion.p
              style={{
                fontSize:      11,
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                color:         "rgba(148,163,184,0.65)",
                fontWeight:    300,
                fontFamily:    "var(--font-dm-sans), 'DM Sans', sans-serif",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.7, ease: "easeOut" }}
            >
              Project Management, Elevated
            </motion.p>
          </div>

          {/* ── Progress bar ─────────────────────────────────────────────── */}
          <div
            className="absolute overflow-hidden rounded-full"
            style={{
              bottom: 40,
              width:  160,
              height: 2,
              background: "rgba(255,255,255,0.07)",
            }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #7c3aed 0%, #4f46e5 60%, #818cf8 100%)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                delay:    0.35,
                duration: (SHOW_MS - 350) / 1000,
                ease:     "linear",
              }}
            />
          </div>

          {/* ── Scan-line texture overlay (subtle CRT feel) ───────────────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
              mixBlendMode: "multiply",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
