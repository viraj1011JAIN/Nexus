/**
 * WCAG 2.1 AA Color Contrast Utilities
 *
 * Provides helpers to calculate relative luminance and contrast ratio,
 * and validates that all 13 Nexus priority/status colors meet the WCAG
 * thresholds before they reach production.
 *
 * Design system tokens:
 * ─────────────────────────────────────────────────────────────────────
 * Priority colours come from copilot-instructions.md §13.1:
 *   Urgent   = red-500   (#ef4444)
 *   High     = orange-400 (#fb923c)
 *   Medium   = cyan-400  (#22d3ee)
 *   Low      = green-400 (#4ade80)
 *
 * Board-status colours used across charts and analytics panels:
 *   Todo     = slate-400  (#94a3b8)
 *   In Progress = violet-500 (#8b5cf6)
 *   In Review   = amber-400  (#fbbf24)
 *   Done     = emerald-500 (#10b981)
 *   Blocked  = rose-500   (#f43f5e)
 *
 * WCAG AA thresholds (ISO/IEC 40500:2012):
 *   Normal text (< 18 pt / < 14 pt bold): contrast ≥ 4.5 : 1
 *   Large text  (≥ 18 pt / ≥ 14 pt bold): contrast ≥ 3.0 : 1
 *   UI components / graphical objects:    contrast ≥ 3.0 : 1
 * ─────────────────────────────────────────────────────────────────────
 *
 * Usage
 * ─────
 *   import { getContrastingTextColor, auditPriorityContrast } from "@/lib/colors";
 *
 *   // Automatically select black or white chip text for any background:
 *   const textColor = getContrastingTextColor("#ef4444"); // → "#000000" (red-500 luminance ≈ 0.229 > midpoint 0.179)
 *
 *   // Guard in tests/CI — fails if any priority token drops below AA-Large:
 *   const failures = auditPriorityContrast().filter(r => r.level === "Fail");
 *   if (failures.length) throw new Error("Contrast regression detected");
 */

// ─── Priority Color Palette ─────────────────────────────────────────────────

export const PRIORITY_COLORS = {
  URGENT: { bg: "#ef4444", label: "Urgent" },  // Tailwind red-500
  HIGH:   { bg: "#fb923c", label: "High" },    // Tailwind orange-400
  MEDIUM: { bg: "#22d3ee", label: "Medium" },  // Tailwind cyan-400
  LOW:    { bg: "#4ade80", label: "Low" },     // Tailwind green-400
  NONE:   { bg: "#6b7280", label: "None" },    // Tailwind gray-500
} as const;

export type PriorityKey = keyof typeof PRIORITY_COLORS;

// ─── Board-Status Color Palette ─────────────────────────────────────────────

export const STATUS_COLORS = {
  TODO:        { bg: "#94a3b8", label: "To Do" },         // slate-400
  IN_PROGRESS: { bg: "#8b5cf6", label: "In Progress" },   // violet-500
  IN_REVIEW:   { bg: "#fbbf24", label: "In Review" },     // amber-400
  DONE:        { bg: "#10b981", label: "Done" },           // emerald-500
  BLOCKED:     { bg: "#f43f5e", label: "Blocked" },       // rose-500
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

// ─── Math Helpers ────────────────────────────────────────────────────────────

/**
 * Convert a 6-digit hex colour string (with or without leading `#`) to an
 * RGB tuple of 8-bit channel values.
 *
 * @throws {Error} if the hex string is not a valid 6-digit hex color
 */
export function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(
      `hexToRgb: expected a 6-digit hex color, received "${hex}"`,
    );
  }
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

/**
 * Gamma-correct a single 8-bit channel value to linear light (sRGB → linear).
 *
 * Formula per WCAG 2.x:
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the WCAG relative luminance of a hex colour.
 * Result is in [0, 1]: 0 = absolute black, 1 = absolute white.
 */
export function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * linearize(r) +
    0.7152 * linearize(g) +
    0.0722 * linearize(b)
  );
}

/**
 * Calculate the WCAG contrast ratio between two hex colours.
 * Returns a value in [1, 21]; 1 = identical colors, 21 = black on white.
 *
 * @param foreground - The colour of the text / foreground element
 * @param background - The colour of the surface behind it
 */
export function getContrastRatio(foreground: string, background: string): number {
  const L1 = getLuminance(foreground);
  const L2 = getLuminance(background);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Decision Helpers ────────────────────────────────────────────────────────

/**
 * Returns `"#ffffff"` or `"#000000"` — whichever provides higher contrast
 * against the given background colour.
 *
 * Use this to automatically pick a chip label colour that is always legible:
 *
 *   ```tsx
 *   <span style={{ background: token.bg, color: getContrastingTextColor(token.bg) }}>
 *     {token.label}
 *   </span>
 *   ```
 */
export function getContrastingTextColor(bg: string): "#ffffff" | "#000000" {
  const ratioWithWhite = getContrastRatio("#ffffff", bg);
  const ratioWithBlack = getContrastRatio("#000000", bg);
  return ratioWithWhite >= ratioWithBlack ? "#ffffff" : "#000000";
}

/**
 * Maps a numeric contrast ratio to its WCAG compliance level.
 *
 * "Fail"     — below 3 : 1  (non-compliant even for large text)
 * "AA-Large" — 3 : 1 to < 4.5 : 1  (compliant for large text / UI components)
 * "AA"       — 4.5 : 1 to < 7 : 1  (compliant for normal text)
 * "AAA"      — 7 : 1 and above     (enhanced compliance)
 */
export function getWcagLevel(
  ratio: number,
): "AAA" | "AA" | "AA-Large" | "Fail" {
  if (ratio >= 7)   return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3)   return "AA-Large";
  return "Fail";
}

// ─── Audit Helpers ───────────────────────────────────────────────────────────

export interface ContrastAuditResult {
  key:       string;
  label:     string;
  bg:        string;
  textColor: "#ffffff" | "#000000";
  ratio:     number;
  /** Rounded to two decimal places for readable test output */
  ratioDisplay: string;
  level:     ReturnType<typeof getWcagLevel>;
  passes:    { aa: boolean; aaLarge: boolean };
}

function auditPalette(
  palette: Record<string, { bg: string; label: string }>,
): ContrastAuditResult[] {
  return Object.entries(palette).map(([key, { bg, label }]) => {
    const textColor = getContrastingTextColor(bg);
    const ratio     = getContrastRatio(textColor, bg);
    const level     = getWcagLevel(ratio);
    return {
      key,
      label,
      bg,
      textColor,
      ratio,
      ratioDisplay: ratio.toFixed(2),
      level,
      passes: {
        aa:      ratio >= 4.5,
        aaLarge: ratio >= 3,
      },
    };
  });
}

/**
 * Validates all five priority colour tokens against WCAG contrast rules.
 *
 * `passes.aaLarge` must be `true` for priority badge chips (3 : 1 minimum
 * for UI components per WCAG 1.4.11).  `passes.aa` must be `true` if labels
 * are rendered at normal body-text size.
 *
 * Returns an array of {@link ContrastAuditResult} — one entry per priority.
 * An empty-filtered result (`filter(r => !r.passes.aaLarge)`) means all
 * tokens are compliant.
 *
 * @example
 * ```typescript
 * // In CI / Jest test:
 * const failures = auditPriorityContrast().filter(r => !r.passes.aaLarge);
 * expect(failures).toHaveLength(0);
 * ```
 */
export function auditPriorityContrast(): ContrastAuditResult[] {
  return auditPalette(PRIORITY_COLORS as Record<string, { bg: string; label: string }>);
}

/**
 * Validates all five board-status colour tokens against WCAG contrast rules.
 * Same semantics as {@link auditPriorityContrast}.
 */
export function auditStatusContrast(): ContrastAuditResult[] {
  return auditPalette(STATUS_COLORS as Record<string, { bg: string; label: string }>);
}

/**
 * Validates both priority and status palettes together.
 * Convenience function for a single-call CI assertion.
 *
 * @example
 * ```typescript
 * const failures = auditAllContrast().filter(r => !r.passes.aaLarge);
 * expect(failures).toHaveLength(0); // fails the build if any token regresses
 * ```
 */
export function auditAllContrast(): ContrastAuditResult[] {
  return [...auditPriorityContrast(), ...auditStatusContrast()];
}
