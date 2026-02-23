import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright Configuration — Nexus E2E Tests
 *
 * Tests run against a locally-running dev server (started automatically by
 * webServer or pre-started via `npm run dev`).
 *
 * Auth state is stored in `e2e/.auth/` so tests can share authenticated sessions.
 *
 * Environment variables:
 *   PLAYWRIGHT_BASE_URL  — override base URL (default: http://localhost:3000)
 *   CI                   — when set, runs in CI mode (no retries on auth, etc.)
 */

export default defineConfig({
  testDir: path.join(__dirname, "e2e"),
  fullyParallel: true,

  /* Fail the build on CI if test.only is left in source */
  forbidOnly: !!process.env.CI,

  /* Retry twice on CI to avoid flaky failures */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallelism on CI to avoid resource exhaustion */
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",

    /* Collect traces on retry — invaluable for CI debugging */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on retry */
    video: "on-first-retry",
  },

  projects: [
    /* ─── Setup: User A (primary test account) ──────────────────────────── */
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    /* ─── Setup: User B (second org – required for tenant isolation tests) ─ */
    {
      name: "setup-b",
      testMatch: "**/auth-user-b.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    /* ─── Authenticated browsers ─────────────────────────────────────────── */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    /* ─── Tenant-isolation (dual-context: User A + User B) ───────────────── */
    {
      name: "tenant-isolation",
      testMatch: "**/tenant-isolation.spec.ts",
      use: { ...devices["Desktop Chrome"] },
      // Depends on BOTH auth setups so storage-state files exist before tests run
      dependencies: ["setup", "setup-b"],
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    /* Mobile viewport — boards must be usable on mobile */
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  /* Start the Next.js dev server if it is not already running */
  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
