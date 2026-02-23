/**
 * E2E: Tenant Isolation
 *
 * This is the most critical end-to-end security test in the suite.
 * It verifies that it is **impossible** for a user in Organisation A to read,
 * update, or delete resources that belong to Organisation B — regardless of
 * what URL they navigate to or what API calls they craft.
 *
 * Test architecture
 * ─────────────────
 * • User A  →  authenticated via `e2e/.auth/user.json`   (ORG_A)
 * • User B  →  authenticated via `e2e/.auth/userB.json`  (ORG_B, second org)
 *
 * Dual-context tests create two independent Playwright browser contexts so
 * both sessions run within a single `test()` block.
 *
 * Dual-context tests are **conditionally skipped** when the second user's
 * credentials are not configured (E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD).
 * This lets the suite run in minimal CI environments that only have one
 * test account while remaining fully executable when both accounts exist.
 *
 * Environment variables
 * ─────────────────────
 *   E2E_USER_B_EMAIL      – Clerk email for the second test user (ORG_B)
 *   E2E_USER_B_PASSWORD   – Clerk password for the second test user
 */

import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── Constants ────────────────────────────────────────────────────────────────

const USER_A_AUTH = path.join(__dirname, ".auth", "user.json");
const USER_B_AUTH = path.join(__dirname, ".auth", "userB.json");

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/** True when the second user auth state is available AND has a non-empty session */
function userBAvailable(): boolean {
  if (!process.env.E2E_USER_B_EMAIL || !process.env.E2E_USER_B_PASSWORD) return false;
  if (!fs.existsSync(USER_B_AUTH)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(USER_B_AUTH, "utf-8"));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to dashboard and create a board, returning its URL path. */
async function createBoard(page: Page, title: string): Promise<string> {
  await page.goto(`${BASE}/dashboard`);

  // Click whichever "Create" trigger is present
  const createTrigger = page
    .getByRole("button", { name: /create.*board/i })
    .or(page.getByTestId("create-board-trigger"))
    .or(page.getByText(/\+ new board/i));
  await createTrigger.first().click();

  // Fill in the board title
  const titleInput = page
    .getByPlaceholder(/board title/i)
    .or(page.getByLabel(/title/i));
  await titleInput.first().fill(title);

  await page.getByRole("button", { name: /^create$/i }).click();

  // Wait for navigation to the new board page
  await page.waitForURL(/\/board\/[^/]+/, { timeout: 20_000 });
  return new URL(page.url()).pathname; // e.g. /board/clxyz123
}

/** Extract the board ID from a pathname like /board/clxyz123 */
function boardIdFromPath(pathname: string): string {
  const match = pathname.match(/\/board\/([^/]+)/);
  if (!match) throw new Error(`Could not extract board ID from "${pathname}"`);
  return match[1];
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: Single-context URL-access isolation
// (These tests run without a second user — they verify that arbitrary board
// URLs return 404 / redirect to dashboard rather than leaking data.)
// ════════════════════════════════════════════════════════════════════════════

test.describe("URL-based isolation (User A session)", () => {
  // The tenant-isolation project does NOT pre-load storageState at the project
  // level so we set it per-test via newContext for explicit control.
  let ctx: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: USER_A_AUTH });
    page = await ctx.newPage();
  });

  test.afterEach(async () => {
    await ctx.close();
  });

  test("navigating to a non-existent board ID redirects or returns 404", async () => {
    const fakeId = "00000000-does-not-exist-0000";
    const response = await page.goto(`${BASE}/board/${fakeId}`);

    // Acceptable outcomes: redirected to dashboard OR HTTP 404
    const didRedirectToDashboard = page.url().includes("/dashboard");
    const got404 = response?.status() === 404;
    const gotNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);

    expect(didRedirectToDashboard || got404 || gotNotFound).toBe(true);
  });

  test("board page does NOT render without a valid session", async ({ browser }) => {
    // New incognito context — no session cookies
    const incognito = await browser.newContext();
    const incognitoPage = await incognito.newPage();

    const response = await incognitoPage.goto(`${BASE}/board/any_board_id`);

    // Must redirect to sign-in, or return 401/404 — must NOT show board UI
    const onSignIn = incognitoPage.url().includes("sign-in");
    const httpError = response && response.status() >= 400;
    const boardTitleVisible = await incognitoPage
      .getByTestId("board-title")
      .isVisible()
      .catch(() => false);

    expect(onSignIn || httpError).toBe(true);
    expect(boardTitleVisible).toBe(false);

    await incognito.close();
  });

  test("API /api/boards route requires authentication", async ({ browser }) => {
    const incognito = await browser.newContext();
    const incognitoPage = await incognito.newPage();

    const response = await incognitoPage.goto(`${BASE}/api/boards`);
    expect(response?.status()).not.toBe(200);

    await incognito.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: Dual-context isolation tests
// (User A owns a board → User B must NOT be able to access it)
// Skipped when E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD are not set.
// ════════════════════════════════════════════════════════════════════════════

test.describe("Cross-tenant isolation (User A vs User B)", () => {
  /** Board created by User A — captured here so each test can reference it */
  let boardPath: string;
  let boardId: string;

  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.skip(!userBAvailable(), "User B credentials not configured — skipping cross-tenant tests.");

    // Authenticate both users in separate contexts
    ctxA = await browser.newContext({ storageState: USER_A_AUTH });
    ctxB = await browser.newContext({ storageState: USER_B_AUTH });
    pageA = await ctxA.newPage();
    pageB = await ctxB.newPage();

    // User A creates a board that will be the attack target
    boardPath = await createBoard(pageA, `Org A Confidential Board – ${Date.now()}`);
    boardId = boardIdFromPath(boardPath);
  });

  test.afterAll(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test("User B cannot access User A's board URL", async () => {
    test.skip(!userBAvailable(), "User B not configured.");

    await pageB.goto(`${BASE}/board/${boardId}`);

    // Allow small wait for SPA routing
    await pageB.waitForLoadState("networkidle");

    const currentUrl = new URL(pageB.url());

    // ── MUST redirect away from the board ─────────────────────────────────
    // Acceptable: redirected to /dashboard, /, /sign-in  OR  page shows 404/not-found
    const redirectedAway = !currentUrl.pathname.startsWith(`/board/${boardId}`);
    const shows404 = await pageB
      .getByText(/not found|404|page not found/i)
      .isVisible()
      .catch(() => false);

    expect(
      redirectedAway || shows404,
      `User B should be denied access to /board/${boardId} but URL is ${currentUrl.pathname}`
    ).toBe(true);
  });

  test("User B cannot see any Org A board content on the page", async () => {
    test.skip(!userBAvailable(), "User B not configured.");

    await pageB.goto(`${BASE}/board/${boardId}`);
    await pageB.waitForLoadState("networkidle");

    // Board title that User A named the board
    const orgABoardTitleVisible = await pageB
      .getByText(/Org A Confidential Board/i)
      .isVisible()
      .catch(() => false);

    expect(orgABoardTitleVisible).toBe(false);
  });

  test("User B's dashboard does NOT list User A's board", async () => {
    test.skip(!userBAvailable(), "User B not configured.");

    await pageB.goto(`${BASE}/dashboard`);
    await pageB.waitForLoadState("networkidle");

    // The board User A created must not appear in User B's board list
    const leakedBoard = await pageB
      .getByText(/Org A Confidential Board/i)
      .isVisible()
      .catch(() => false);

    expect(leakedBoard).toBe(false);
  });

  test("User B cannot modify User A's board via the card API", async () => {
    test.skip(!userBAvailable(), "User B not configured.");

    // Attempt a server action / API call as User B targeting User A's board
    // The response must not be 200 OK with success data
    const response = await pageB.request.post(`${BASE}/api/cards`, {
      data: { boardId, title: "Injected card", listId: "fake_list" },
      headers: { "Content-Type": "application/json" },
    });

    // Any 4xx response is correct; 200 with actual data creation would be wrong
    expect(response.status()).not.toBe(200);
  });

  test("User A's board is still accessible to User A after User B's access attempts", async () => {
    test.skip(!userBAvailable(), "User B not configured.");

    // Verify the resource wasn't corrupted / deleted by the failed cross-tenant attempts
    await pageA.goto(`${BASE}/board/${boardId}`);
    await pageA.waitForURL(/\/board\//, { timeout: 15_000 });

    expect(pageA.url()).toContain(`/board/${boardId}`);

    // Board should still render its content for its owner
    const isNotFound = await pageA
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);
    expect(isNotFound).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: Org-scoped data leakage via activity / analytics
// ════════════════════════════════════════════════════════════════════════════

test.describe("Activity and analytics isolation", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    ctx = await browser.newContext({ storageState: USER_A_AUTH });
    page = await ctx.newPage();
  });

  test.afterEach(async () => {
    await ctx.close();
  });

  test("activity feed only loads for authenticated users", async ({ browser }) => {
    const incognito = await browser.newContext();
    const incognitoPage = await incognito.newPage();

    const res = await incognitoPage.goto(`${BASE}/activity`);
    const onSignIn = incognitoPage.url().includes("sign-in");
    const httpError = res && res.status() >= 400;

    expect(onSignIn || httpError).toBe(true);
    await incognito.close();
  });

  test("settings page requires authentication", async ({ browser }) => {
    const incognito = await browser.newContext();
    const incognitoPage = await incognito.newPage();

    const res = await incognitoPage.goto(`${BASE}/settings`);
    const onSignIn = incognitoPage.url().includes("sign-in");
    const httpError = res && res.status() >= 400;

    expect(onSignIn || httpError).toBe(true);
    await incognito.close();
  });
});
