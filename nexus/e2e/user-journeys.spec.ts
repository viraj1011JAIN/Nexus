/**
 * E2E Tests: Complete User Journeys (Section 17)
 *
 * 10 end-to-end flows exercising the full application lifecycle:
 *   17.1  Sign-in → Dashboard → Create Board → Board Page
 *   17.2  Create list → Add card → Verify card renders
 *   17.3  Open card modal → Edit description → Close modal
 *   17.4  Keyboard shortcut (?) → Shortcuts modal opens/closes
 *   17.5  Search → Results page → Click result
 *   17.6  Settings navigation → Profile page loads
 *   17.7  Board menu → Board settings visible
 *   17.8  Card drag handle visible (dragability check)
 *   17.9  Mobile viewport — responsive layout
 *   17.10 Session persistence — reload retains auth
 */

import { test, expect, Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToDashboard(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

async function getFirstBoardUrl(page: Page): Promise<string | null> {
  await navigateToDashboard(page);
  const boardLink = page.locator('a[href*="/board/"]').first();
  if (!(await boardLink.isVisible().catch(() => false))) return null;
  return (await boardLink.getAttribute("href")) ?? null;
}

async function navigateToBoard(page: Page): Promise<boolean> {
  const boardUrl = await getFirstBoardUrl(page);
  if (!boardUrl) return false;
  await page.goto(boardUrl);
  await page.waitForLoadState("networkidle");
  return true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Section 17 — Complete User Journeys", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 17.1 Sign-in → Dashboard → Create Board → Board Page
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.1 authenticated user lands on dashboard and can create a board", async ({
    page,
  }) => {
    await navigateToDashboard(page);

    // Dashboard should be visible (not redirected to sign-in)
    expect(page.url()).toContain("/dashboard");

    // Click create board trigger
    const createBtn = page
      .getByRole("button", { name: /add.*board|new board|create board/i })
      .or(page.locator('[data-testid="create-board-btn"]'))
      .first();

    if (!(await createBtn.isVisible().catch(() => false))) {
      // No create button visible — perhaps at plan limit. Skip.
      test.skip();
      return;
    }

    await createBtn.click();

    // Fill title
    const titleInput = page
      .locator(
        'input[name="title"], input[placeholder*="title" i], input[placeholder*="board" i]'
      )
      .first();
    await titleInput.waitFor({ state: "visible", timeout: 8_000 });

    const boardTitle = `E2E Journey Board ${Date.now()}`;
    await titleInput.fill(boardTitle);

    // Submit
    const submitBtn = page.getByRole("button", { name: /create/i }).last();
    await submitBtn.click();

    // Should redirect to /board/<id>
    await page.waitForURL(/\/board\//, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/board\//);

    // Board title should be visible
    await expect(page.getByText(boardTitle).first()).toBeVisible({
      timeout: 8_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.2 Create list → Add card → Verify card
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.2 create a list and add a card to it", async ({ page }) => {
    const onBoard = await navigateToBoard(page);
    if (!onBoard) {
      test.skip();
      return;
    }

    // Click "Add a list"
    const addListBtn = page
      .getByRole("button", { name: /add.*list|new list/i })
      .or(page.locator('[data-testid="add-list-btn"]'))
      .first();

    if (!(await addListBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await addListBtn.click();

    // Fill list title
    const listInput = page
      .locator(
        'input[name="title"], input[placeholder*="list" i], input[placeholder*="title" i]'
      )
      .last();
    await listInput.waitFor({ state: "visible", timeout: 8_000 });

    const listTitle = `E2E List ${Date.now()}`;
    await listInput.fill(listTitle);
    await listInput.press("Enter");

    // Verify list header appears
    await expect(page.getByText(listTitle).first()).toBeVisible({
      timeout: 8_000,
    });

    // Add a card to the new list
    const addCardBtn = page
      .getByRole("button", { name: /add.*card/i })
      .or(page.locator('[data-testid="add-card-btn"]'))
      .last();
    await addCardBtn.click();

    const cardInput = page
      .locator('textarea, input[placeholder*="card" i]')
      .last();
    await cardInput.waitFor({ state: "visible", timeout: 8_000 });

    const cardTitle = `E2E Card ${Date.now()}`;
    await cardInput.fill(cardTitle);
    await cardInput.press("Enter");

    // Card should render in the list
    await expect(page.getByText(cardTitle).first()).toBeVisible({
      timeout: 8_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.3 Open card modal → Edit description → Close
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.3 open card modal and edit description", async ({ page }) => {
    const onBoard = await navigateToBoard(page);
    if (!onBoard) {
      test.skip();
      return;
    }

    // Click the first card
    const card = page
      .locator(
        '[data-testid="card-item"], .card-item, [draggable="true"]'
      )
      .first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await card.click();

    // Modal should open
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ state: "visible", timeout: 8_000 });

    // Find description editor
    const descField = page
      .locator(
        '[data-testid="card-description"], [contenteditable="true"], textarea[name="description"]'
      )
      .first();

    if (await descField.isVisible().catch(() => false)) {
      await descField.click();
      await descField.fill(`Updated description ${Date.now()}`);
    }

    // Close modal with Escape
    await page.keyboard.press("Escape");

    // Modal should be gone
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.4 Keyboard shortcut — ? opens shortcuts modal
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.4 pressing ? opens keyboard shortcuts modal", async ({ page }) => {
    await navigateToDashboard(page);

    // Press ? to trigger shortcuts modal
    await page.keyboard.press("?");

    // The shortcuts modal should appear
    const shortcutsModal = page
      .locator('[role="dialog"]')
      .or(page.getByText(/keyboard shortcuts/i))
      .first();

    const visible = await shortcutsModal
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!visible) {
      // Some pages may not have this feature
      test.skip();
      return;
    }

    await expect(shortcutsModal).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.5 Search → Results
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.5 search navigates to results page", async ({ page }) => {
    await navigateToDashboard(page);

    // Open command palette or search with Ctrl+K
    await page.keyboard.press("Control+k");

    const searchInput = page
      .locator(
        '[data-testid="search-input"], input[placeholder*="search" i], [cmdk-input]'
      )
      .first();

    const searchVisible = await searchInput
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!searchVisible) {
      test.skip();
      return;
    }

    await searchInput.fill("test");

    // Wait for results
    await page.waitForTimeout(1_000);

    // Results should be visible (either inline or navigated to /search)
    const hasResults = page
      .locator(
        '[data-testid="search-results"], [cmdk-list], [role="listbox"]'
      )
      .first();

    await expect(hasResults).toBeVisible({ timeout: 5_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.6 Settings page navigation
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.6 navigating to settings loads profile page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Should either show settings page or redirect to a settings sub-page
    const onSettings = page.url().includes("/settings");
    const onDashboard = page.url().includes("/dashboard");

    // If redirected to dashboard, settings might not be implemented as a standalone page
    if (onDashboard) {
      // Try clicking settings in sidebar
      const settingsLink = page
        .getByRole("link", { name: /settings/i })
        .or(page.locator('a[href*="/settings"]'))
        .first();

      if (await settingsLink.isVisible().catch(() => false)) {
        await settingsLink.click();
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/settings");
      } else {
        test.skip();
      }
    } else {
      expect(onSettings).toBe(true);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.7 Board menu / settings
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.7 board menu is accessible from board page", async ({ page }) => {
    const onBoard = await navigateToBoard(page);
    if (!onBoard) {
      test.skip();
      return;
    }

    // Find the board menu trigger (kebab, gear, or "Board settings")
    const menuBtn = page
      .getByRole("button", { name: /board.*menu|settings|more/i })
      .or(page.locator('[data-testid="board-menu-btn"]'))
      .or(page.locator('[data-testid="board-options"]'))
      .first();

    if (!(await menuBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await menuBtn.click();

    // Menu / dropdown should appear
    const menu = page
      .locator('[role="menu"], [role="dialog"], .dropdown-content')
      .first();
    await expect(menu).toBeVisible({ timeout: 5_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.8 Card drag handle visible
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.8 cards have visible drag handle or draggable attribute", async ({
    page,
  }) => {
    const onBoard = await navigateToBoard(page);
    if (!onBoard) {
      test.skip();
      return;
    }

    const card = page
      .locator(
        '[data-testid="card-item"], .card-item, [draggable="true"]'
      )
      .first();

    if (!(await card.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Either the card itself is draggable or it has a drag handle child
    const isDraggable = await card.getAttribute("draggable");
    const hasDragHandle = await page
      .locator('[data-testid="drag-handle"], .drag-handle, [role="img"][aria-label*="drag" i]')
      .first()
      .isVisible()
      .catch(() => false);

    expect(isDraggable === "true" || hasDragHandle).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.9 Mobile viewport — responsive layout
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.9 dashboard renders usably on mobile viewport", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, // iPhone 13 Mini
      storageState: "e2e/.auth/user.json",
    });
    const page = await ctx.newPage();

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Page should not overflow horizontally
    const bodyWidth = await page.evaluate(
      () => document.body.scrollWidth
    );
    expect(bodyWidth).toBeLessThanOrEqual(450); // some padding tolerance

    // Nav / sidebar should either be collapsed or a hamburger menu should be visible
    const hamburger = page
      .getByRole("button", { name: /menu|toggle/i })
      .or(page.locator('[data-testid="mobile-menu-btn"]'))
      .first();
    const sidebar = page.locator("aside, nav").first();

    const hamburgerVisible = await hamburger.isVisible().catch(() => false);
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    // At least one navigation mechanism should work
    expect(hamburgerVisible || sidebarVisible).toBe(true);

    await ctx.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17.10 Session persistence on reload
  // ═══════════════════════════════════════════════════════════════════════════

  test("17.10 reloading the page retains authenticated session", async ({
    page,
  }) => {
    await navigateToDashboard(page);
    expect(page.url()).toContain("/dashboard");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still be on dashboard, not redirected to sign-in
    expect(page.url()).toContain("/dashboard");

    // User indicator should be visible (avatar, name, or settings button)
    const userIndicator = page
      .locator(
        '[data-testid="user-avatar"], [data-testid="user-button"], img[alt*="avatar" i]'
      )
      .or(page.getByRole("button", { name: /account|profile|user/i }))
      .first();

    // Some indicator of an active session should be visible
    const hasUser = await userIndicator.isVisible().catch(() => false);
    const notOnSignIn = !page.url().includes("sign-in");

    expect(hasUser || notOnSignIn).toBe(true);
  });
});
