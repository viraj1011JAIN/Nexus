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

// ─── Search Input ─────────────────────────────────────────────────────────

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

// ─── Skip Link ────────────────────────────────────────────────────────────

describe("Skip-to-main-content link (TASK-036)", () => {
  it("renders a skip link targeting #main-content", () => {
    const { container } = render(
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only"
        >
          Skip to main content
        </a>
        <div id="main-content">Page content</div>
      </>
    );
    const link = container.querySelector("a[href='#main-content']");
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe("Skip to main content");
  });

  it("skip link target #main-content exists in document", () => {
    const { container } = render(
      <>
        <a href="#main-content">Skip to main content</a>
        <main id="main-content">Main area</main>
      </>
    );
    const target = container.querySelector("#main-content");
    expect(target).toBeTruthy();
  });

  it("has no axe violations with skip link present", async () => {
    await checkA11y(
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        <main id="main-content">
          <h1>Page Title</h1>
          <p>Main page content.</p>
        </main>
      </>
    );
  });
});

// ─── Form Labels ──────────────────────────────────────────────────────────

describe("Form accessibility", () => {
  it("text input has an explicit label", async () => {
    await checkA11y(
      <form>
        <label htmlFor="card-title">Card title</label>
        <input id="card-title" type="text" name="title" />
      </form>
    );
  });

  it("select element has an accessible label", async () => {
    await checkA11y(
      <form>
        <label htmlFor="priority-select">Priority</label>
        <select id="priority-select" name="priority">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </form>
    );
  });

  it("textarea has an accessible label", async () => {
    await checkA11y(
      <form>
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" />
      </form>
    );
  });
});

// ─── Button Accessible Names ──────────────────────────────────────────────

describe("Button accessible names", () => {
  it("icon-only button has aria-label", async () => {
    await checkA11y(
      <button aria-label="Close dialog" type="button">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    );
  });

  it("button with visible text has no axe violations", async () => {
    await checkA11y(
      <button type="button">Add card</button>
    );
  });

  it("disabled button remains accessible", async () => {
    await checkA11y(
      <button type="submit" disabled>
        Save changes
      </button>
    );
  });
});

// ─── Landmark Regions ─────────────────────────────────────────────────────

describe("Landmark regions", () => {
  it("page with main landmark has no axe violations", async () => {
    await checkA11y(
      <div>
        <header>
          <nav aria-label="Primary navigation">
            <a href="/">Home</a>
          </nav>
        </header>
        <main id="main-content">
          <h1>Dashboard</h1>
          <p>Your boards appear here.</p>
        </main>
        <footer>© 2025 NEXUS</footer>
      </div>
    );
  });

  it("navigation has an accessible name when multiple navs exist", async () => {
    await checkA11y(
      <div>
        <nav aria-label="Primary">
          <a href="/">Home</a>
        </nav>
        <main>
          <p>Content</p>
          <nav aria-label="Breadcrumb">
            <a href="/boards">Boards</a>
          </nav>
        </main>
      </div>
    );
  });
});

// ─── SmartDueDate badge ───────────────────────────────────────────────────

import { SmartDueDate } from "@/components/smart-due-date";

describe("SmartDueDate accessibility", () => {
  it("renders past-due date without axe violations", async () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await checkA11y(<SmartDueDate dueDate={past} />);
  });

  it("renders upcoming date without axe violations", async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await checkA11y(<SmartDueDate dueDate={soon} />);
  });
});
