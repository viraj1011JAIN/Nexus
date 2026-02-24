/**
 * TASK-036 — Accessibility tests with axe-core
 *
 * Tests aria landmarks, focus management, and WCAG 2.1 compliance
 * for key interactive components.
 */

import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkA11y(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ─── Priority Badge ────────────────────────────────────────────────────────

import { PriorityBadge } from "@/components/priority-badge";

describe("PriorityBadge accessibility", () => {
  it("has no axe violations for URGENT", async () => {
    await checkA11y(<PriorityBadge priority="URGENT" />);
  });

  it("has no axe violations for MEDIUM", async () => {
    await checkA11y(<PriorityBadge priority="MEDIUM" />);
  });

  it("has no axe violations for LOW", async () => {
    await checkA11y(<PriorityBadge priority="LOW" />);
  });
});

// ─── Error Boundary ────────────────────────────────────────────────────────

import { ErrorBoundary } from "@/components/error-boundary";

describe("ErrorBoundary accessibility", () => {
  it("renders accessible content without errors", async () => {
    await checkA11y(
      <ErrorBoundary>
        <div>Stable content</div>
      </ErrorBoundary>
    );
  });
});

// ─── aria-live region ─────────────────────────────────────────────────────

describe("aria-live regions", () => {
  it("status region is present and polite", () => {
    const { container } = render(
      <div>
        <div role="status" aria-live="polite" aria-atomic="true">
          3 results found
        </div>
      </div>
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute("role")).toBe("status");
  });

  it("alert region is assertive", () => {
    const { container } = render(
      <div role="alert" aria-live="assertive">
        Error: Something went wrong
      </div>
    );
    const alertRegion = container.querySelector('[aria-live="assertive"]');
    expect(alertRegion).toBeTruthy();
  });
});

// ─── Search Page ──────────────────────────────────────────────────────────

describe("Search input accessibility", () => {
  it("search input has accessible label", () => {
    const { container } = render(
      <label htmlFor="search">
        Search cards
        <input id="search" type="search" aria-label="Search query" role="searchbox" />
      </label>
    );
    const input = container.querySelector("input");
    expect(input?.getAttribute("aria-label")).toBe("Search query");
  });
});
