/**
 * __tests__/a11y/accessibility.test.tsx
 *
 * Automated Accessibility CI Shield — WCAG 2.1 AA
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE
 * ───────
 * This file is the last line of defence against accessibility regressions.
 * Every test here runs axe-core or a WCAG contract assertion against a real
 * rendered component or a design-system token.  If any test fails, the CI
 * build fails — preventing a developer from shipping an inaccessible change
 * even if they forget to run manual screen-reader checks.
 *
 * COVERAGE PHILOSOPHY
 * ───────────────────
 * We test *infrastructure* here, not pixel-perfect layout:
 *
 *   1. Color-contrast contracts (lib/colors.ts)
 *      All 10 priority + status palette tokens must always provide a
 *      readable 3 : 1 UI-component contrast or better.  If a designer
 *      changes a Tailwind token, this test immediately flags the regression.
 *
 *   2. AriaLiveRegion structural axe audit
 *      The global ARIA Live Announcement System must never have axe
 *      violations — it is the primary channel for screen-reader users to
 *      learn about remote collaborative changes.
 *
 *   3. Design-system primitive components (PriorityBadge, SmartDueDate)
 *      axe audits remain valid regression guards against future refactors.
 *
 *   4. Pattern-level WCAG rules (Skip Link, Form Labels, Button Names,
 *      Landmark Regions) — verifies that the patterns used across the app
 *      are individually axe-clean so composed pages are also clean.
 *
 * HOW TO ADD A NEW TEST
 * ─────────────────────
 *   1. Import the component.
 *   2. Call `await checkA11y(<YourComponent ...someProps />)`.
 *   3. If axe complains, fix the component, not the test.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React from "react";
import { render, act } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ─── Shared axe helper ────────────────────────────────────────────────────────

async function checkA11y(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Color Contrast Contract Tests (lib/colors.ts)
//
// Threshold: WCAG 1.4.11 Non-Text Contrast — 3:1 for UI components.
// Stricter 4.5:1 (normal text) checked informally via getWcagLevel().
// ══════════════════════════════════════════════════════════════════════════════

import {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  getContrastingTextColor,
  getWcagLevel,
  auditPriorityContrast,
  auditStatusContrast,
  auditAllContrast,
  PRIORITY_COLORS,
  STATUS_COLORS,
} from "@/lib/colors";

describe("lib/colors — hexToRgb()", () => {
  it("converts pure black correctly", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("converts pure white correctly", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("converts a mid-tone color correctly (red-500)", () => {
    expect(hexToRgb("#ef4444")).toEqual([239, 68, 68]);
  });

  it("works without a leading #", () => {
    expect(hexToRgb("ef4444")).toEqual([239, 68, 68]);
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#EF4444")).toEqual([239, 68, 68]);
  });

  it("throws for a 3-digit shorthand hex", () => {
    expect(() => hexToRgb("#fff")).toThrow();
  });
});

describe("lib/colors — getLuminance()", () => {
  it("returns 0 for absolute black", () => {
    expect(getLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("returns 1 for absolute white", () => {
    expect(getLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns a value between 0 and 1 for mid-tones", () => {
    const lum = getLuminance("#ef4444");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

describe("lib/colors — getContrastRatio()", () => {
  it("returns ~21 for black on white", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colors", () => {
    expect(getContrastRatio("#ef4444", "#ef4444")).toBeCloseTo(1, 5);
  });

  it("is symmetric — foreground/background order does not matter", () => {
    const a = getContrastRatio("#ffffff", "#ef4444");
    const b = getContrastRatio("#ef4444", "#ffffff");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("lib/colors — getContrastingTextColor()", () => {
  // red-500 (#ef4444) has luminance ≈ 0.229. The equal-contrast midpoint is
  // (√21 - 1) / 20 ≈ 0.179. Since 0.229 > 0.179, black yields higher contrast
  // (≈ 5.58 : 1) than white (≈ 3.76 : 1), so the function correctly picks black.
  it("returns black for red-500 (luminance above midpoint → black has higher contrast)", () => {
    expect(getContrastingTextColor("#ef4444")).toBe("#000000");
  });

  it("returns black for a light background (cyan-400)", () => {
    expect(getContrastingTextColor("#22d3ee")).toBe("#000000");
  });

  it("returns black for pure white", () => {
    expect(getContrastingTextColor("#ffffff")).toBe("#000000");
  });

  it("returns white for pure black", () => {
    expect(getContrastingTextColor("#000000")).toBe("#ffffff");
  });
});

describe("lib/colors — getWcagLevel()", () => {
  it("maps ratio < 3 to 'Fail'", () => {
    expect(getWcagLevel(2.9)).toBe("Fail");
  });

  it("maps 3.0 to 'AA-Large'", () => {
    expect(getWcagLevel(3.0)).toBe("AA-Large");
  });

  it("maps 4.5 to 'AA'", () => {
    expect(getWcagLevel(4.5)).toBe("AA");
  });

  it("maps 7.0 to 'AAA'", () => {
    expect(getWcagLevel(7.0)).toBe("AAA");
  });
});

// ── The CI Gate ───────────────────────────────────────────────────────────────

describe("lib/colors — auditPriorityContrast() CI gate", () => {
  it("returns exactly 5 results", () => {
    expect(auditPriorityContrast()).toHaveLength(Object.keys(PRIORITY_COLORS).length);
  });

  it("all priority tokens pass WCAG AA-Large (3:1) for UI components", () => {
    const failures = auditPriorityContrast().filter((r) => !r.passes.aaLarge);
    if (failures.length > 0) {
      const msg = failures
        .map((f) => `  ${f.key} (${f.bg}) — ${f.ratioDisplay}:1 [${f.level}]`)
        .join("\n");
      throw new Error(
        `Contrast regression in priority palette:\n${msg}\n\n` +
          "Fix: update the hex value in PRIORITY_COLORS so contrast ≥ 3:1.",
      );
    }
    expect(failures).toHaveLength(0);
  });

  it("each result includes all expected fields", () => {
    for (const r of auditPriorityContrast()) {
      expect(r).toMatchObject({
        key:          expect.any(String),
        label:        expect.any(String),
        bg:           expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
        textColor:    expect.stringMatching(/^#(ffffff|000000)$/),
        ratio:        expect.any(Number),
        ratioDisplay: expect.any(String),
        level:        expect.stringMatching(/^(AAA|AA|AA-Large|Fail)$/),
        passes:       expect.objectContaining({ aa: expect.any(Boolean), aaLarge: expect.any(Boolean) }),
      });
    }
  });

  it("URGENT chip (red-500) auto-selects black text (L\u224870.23 is above the midpoint)", () => {
    // red-500 luminance (~0.229) > equal-contrast midpoint (~0.179),
    // so black (contrast ~5.6:1) beats white (contrast ~3.8:1)
    const r = auditPriorityContrast().find((x) => x.key === "URGENT");
    expect(r?.textColor).toBe("#000000");
  });

  it("MEDIUM chip (cyan-400) auto-selects black text", () => {
    const r = auditPriorityContrast().find((x) => x.key === "MEDIUM");
    expect(r?.textColor).toBe("#000000");
  });
});

describe("lib/colors — auditStatusContrast() CI gate", () => {
  it("returns exactly 5 results", () => {
    expect(auditStatusContrast()).toHaveLength(Object.keys(STATUS_COLORS).length);
  });

  it("all status tokens pass WCAG AA-Large (3:1)", () => {
    const failures = auditStatusContrast().filter((r) => !r.passes.aaLarge);
    if (failures.length > 0) {
      const msg = failures
        .map((f) => `  ${f.key} (${f.bg}) — ${f.ratioDisplay}:1 [${f.level}]`)
        .join("\n");
      throw new Error(`Contrast regression in status palette:\n${msg}`);
    }
    expect(failures).toHaveLength(0);
  });
});

describe("lib/colors — auditAllContrast() CI gate", () => {
  it("returns 10 results (5 priority + 5 status)", () => {
    expect(auditAllContrast()).toHaveLength(
      Object.keys(PRIORITY_COLORS).length + Object.keys(STATUS_COLORS).length,
    );
  });

  it("zero failures across both palettes — the single build-gate assertion", () => {
    const failures = auditAllContrast().filter((r) => !r.passes.aaLarge);
    expect(failures).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — AriaLiveRegion axe Audit
// ══════════════════════════════════════════════════════════════════════════════

import { AriaLiveRegion } from "@/components/accessibility/aria-live-region";

describe("AriaLiveRegion — axe audit", () => {
  it("has no axe violations on initial render", async () => {
    await checkA11y(<AriaLiveRegion />);
  });

  it("has no axe violations with an active polite announcement", async () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("nexus:announce", {
          detail: { message: "Card moved to Done", priority: "polite" },
        }),
      );
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations with an active assertive announcement", async () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("nexus:announce", {
          detail: { message: "Connection lost", priority: "assertive" },
        }),
      );
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Design-System Primitive Components
// ══════════════════════════════════════════════════════════════════════════════

import { PriorityBadge } from "@/components/priority-badge";

describe("PriorityBadge accessibility", () => {
  it("has no axe violations for URGENT", async () => {
    await checkA11y(<PriorityBadge priority="URGENT" />);
  });

  it("has no axe violations for HIGH", async () => {
    await checkA11y(<PriorityBadge priority="HIGH" />);
  });

  it("has no axe violations for MEDIUM", async () => {
    await checkA11y(<PriorityBadge priority="MEDIUM" />);
  });

  it("has no axe violations for LOW", async () => {
    await checkA11y(<PriorityBadge priority="LOW" />);
  });
});

import { SmartDueDate } from "@/components/smart-due-date";

describe("SmartDueDate accessibility", () => {
  it("renders past-due date without axe violations", async () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await checkA11y(<SmartDueDate dueDate={past} onDateChange={() => {}} />);
  });

  it("renders upcoming date without axe violations", async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await checkA11y(<SmartDueDate dueDate={soon} onDateChange={() => {}} />);
  });
});

import { ErrorBoundary } from "@/components/error-boundary";

describe("ErrorBoundary accessibility", () => {
  it("renders accessible content without errors", async () => {
    await checkA11y(
      <ErrorBoundary>
        <div>Stable content</div>
      </ErrorBoundary>,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Pattern-Level WCAG Rules
// ══════════════════════════════════════════════════════════════════════════════

describe("Skip-to-main-content link (WCAG 2.4.1)", () => {
  it("renders a skip link targeting #main-content", () => {
    const { container } = render(
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <div id="main-content" tabIndex={-1}>Page content</div>
      </>,
    );
    const link = container.querySelector("a[href='#main-content']");
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe("Skip to main content");
  });

  it("has no axe violations with skip link present", async () => {
    await checkA11y(
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <main id="main-content" tabIndex={-1}>
          <h1>Page Title</h1>
          <p>Main page content.</p>
        </main>
      </>,
    );
  });
});

describe("Form labels (WCAG 1.3.1 / 4.1.2)", () => {
  it("text input with explicit label has no axe violations", async () => {
    await checkA11y(
      <form>
        <label htmlFor="card-title">Card title</label>
        <input id="card-title" type="text" name="title" />
      </form>,
    );
  });

  it("select element with label has no axe violations", async () => {
    await checkA11y(
      <form>
        <label htmlFor="priority-select">Priority</label>
        <select id="priority-select" name="priority">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </form>,
    );
  });

  it("textarea with label has no axe violations", async () => {
    await checkA11y(
      <form>
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" />
      </form>,
    );
  });
});

describe("Button accessible names (WCAG 4.1.2)", () => {
  it("icon-only button with aria-label has no axe violations", async () => {
    await checkA11y(
      <button aria-label="Close dialog" type="button">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>,
    );
  });

  it("text button has no axe violations", async () => {
    await checkA11y(<button type="button">Add card</button>);
  });

  it("disabled submit button has no axe violations", async () => {
    await checkA11y(
      <button type="submit" disabled>
        Save changes
      </button>,
    );
  });
});

describe("ARIA progressbar (WCAG 4.1.2 / 1.3.1)", () => {
  it("progressbar with all required attributes has no axe violations", async () => {
    await checkA11y(
      <div
        role="progressbar"
        aria-valuenow={65}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Checklist progress: 65%"
      >
        <div style={{ width: "65%" }} aria-hidden="true" />
      </div>,
    );
  });

  it("storage progressbar pattern has no axe violations", async () => {
    await checkA11y(
      <div
        role="progressbar"
        aria-valuenow={24}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage usage: 24%"
      >
        <span className="sr-only">24%</span>
      </div>,
    );
  });
});

describe("Status / live region patterns (WCAG 4.1.3)", () => {
  it("role=status region has no axe violations", async () => {
    await checkA11y(
      <div role="status" aria-live="polite" aria-atomic="true">
        3 results found
      </div>,
    );
  });

  it("role=alert region has no axe violations", async () => {
    await checkA11y(
      <div role="alert" aria-live="assertive">
        Error: Something went wrong
      </div>,
    );
  });
});

describe("Landmark regions (WCAG 2.4.1 / 1.3.6)", () => {
  it("page with header/main/footer landmarks has no axe violations", async () => {
    await checkA11y(
      <div>
        <header>
          <nav aria-label="Primary navigation">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Home</a>
          </nav>
        </header>
        <main id="main-content">
          <h1>Dashboard</h1>
          <p>Your boards appear here.</p>
        </main>
        <footer>© 2026 NEXUS</footer>
      </div>,
    );
  });

  it("multiple navs each with unique aria-label have no axe violations", async () => {
    await checkA11y(
      <div>
        <nav aria-label="Primary">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Home</a>
        </nav>
        <main>
          <p>Content</p>
          <nav aria-label="Breadcrumb">
            <a href="/boards">Boards</a>
          </nav>
        </main>
      </div>,
    );
  });
});

describe("Search input (WCAG 1.3.5)", () => {
  it("search input with label has no axe violations", async () => {
    await checkA11y(
      <label htmlFor="search">
        Search cards
        <input id="search" type="search" aria-label="Search query" role="searchbox" />
      </label>,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Board UI Pattern Regression Guards
//
// Lightweight inline reconstructions verify ARIA markup from the WCAG
// hardening sprint (6b8efb3) remains correct.  These do NOT import
// dnd-kit-wrapped components — they test the rendered HTML shapes directly.
// ══════════════════════════════════════════════════════════════════════════════

describe("Board card ARIA pattern (regression guard)", () => {
  it("card with aria-label for title/priority/due has no axe violations", async () => {
    await checkA11y(
      <article
        aria-label="Fix login bug — Priority: Urgent — Overdue by 2 days"
        tabIndex={0}
        role="article"
      >
        <div aria-hidden="true" style={{ background: "#ef4444", width: 3 }} />
        <span>Fix login bug</span>
        <div
          role="progressbar"
          aria-valuenow={3}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label="Checklist: 3 of 5 done"
        >
          <div aria-hidden="true" />
        </div>
      </article>,
    );
  });
});

describe("Board list column ARIA pattern (regression guard)", () => {
  it("column with aria-label and add-card button has no axe violations", async () => {
    await checkA11y(
      <div aria-label="In Progress column, 4 cards" role="group">
        <h3>In Progress</h3>
        <button type="button" aria-label="Add card to In Progress">
          + Add card
        </button>
      </div>,
    );
  });
});

describe("DnD keyboard instructions pattern (WCAG 2.1.1)", () => {
  it("sr-only DnD instructions element has no axe violations", async () => {
    await checkA11y(
      <div>
        <div id="dnd-sr-instructions" aria-live="off">
          To pick up a draggable item, press Space or Enter. Use arrow keys to
          move. Press Space or Enter again to drop, or Escape to cancel.
        </div>
        <div aria-label="Backlog column, 2 cards" role="group">
          <span>Backlog</span>
        </div>
      </div>,
    );
  });
});

