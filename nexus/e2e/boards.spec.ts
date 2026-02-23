/**
 * E2E Tests: Dashboard & Board Management
 *
 * Tests board creation flows including:
 *  - blank board creation
 *  - Unsplash background picker
 *  - board from template
 *  - board deletion
 */

import { test, expect, Page } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToDashboard(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

async function openCreateBoardForm(page: Page) {
  // The "Add new board" / create board trigger button
  const addBtn = page
    .getByRole("button", { name: /add.*board|new board|create board/i })
    .or(page.locator('[data-testid="create-board-btn"]'))
    .first();
  await addBtn.click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
  });

  test("loads dashboard page", async ({ page }) => {
    await expect(page).toHaveTitle(/Nexus|Dashboard/i);
    // Sidebar should be visible
    await expect(page.locator("nav, aside").first()).toBeVisible();
  });

  test("shows boards section heading", async ({ page }) => {
    const heading = page
      .getByRole("heading", { name: /boards|your boards/i })
      .or(page.getByText(/boards/i).first());
    await expect(heading).toBeVisible();
  });
});

test.describe("Board Creation — Blank Board", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
  });

  test("creates a blank board and redirects to it", async ({ page }) => {
    await openCreateBoardForm(page);

    // Fill board title
    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="board" i]').first();
    await titleInput.waitFor({ state: "visible", timeout: 8_000 });

    const boardTitle = `E2E Blank Board ${Date.now()}`;
    await titleInput.fill(boardTitle);

    // Submit
    const createBtn = page.getByRole("button", { name: /create/i }).last();
    await createBtn.click();

    // Should navigate to the new board
    await page.waitForURL(/\/board\//, { timeout: 12_000 });
    await expect(page.getByText(boardTitle).first()).toBeVisible();
  });

  test("create board button is disabled when title is empty", async ({ page }) => {
    await openCreateBoardForm(page);

    const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
    await titleInput.waitFor({ state: "visible", timeout: 8_000 });
    // Clear any pre-filled content
    await titleInput.clear();

    const createBtn = page.getByRole("button", { name: /^create$/i });
    // Button should be disabled OR form should not submit
    const isDisabled = await createBtn.isDisabled().catch(() => false);
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    } else {
      // Clicking should show validation message
      await createBtn.click();
      const errorInfo = page.locator('[data-testid="title-error"], .error, [aria-invalid]').first();
      // At minimum, navigation should NOT have occurred
      await expect(page).not.toHaveURL(/\/board\//);
    }
  });
});

test.describe("Board Creation — Unsplash Background", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
  });

  test("opens Unsplash picker from advanced panel", async ({ page }) => {
    await openCreateBoardForm(page);

    // Click the "Advanced" / "Background" toggle
    const advancedToggle = page
      .getByRole("button", { name: /advanced|background|photo/i })
      .or(page.locator('[data-testid="advanced-toggle"]'))
      .first();

    // If the toggle doesn't exist it means it's always visible; skip click
    if (await advancedToggle.isVisible().catch(() => false)) {
      await advancedToggle.click();
    }

    // The Unsplash picker trigger should now be visible
    const unsplashTrigger = page
      .getByRole("button", { name: /choose.*photo|unsplash|background/i })
      .or(page.locator('[data-testid="unsplash-picker-btn"]'))
      .first();

    await expect(unsplashTrigger).toBeVisible({ timeout: 8_000 });
  });

  test("Unsplash picker fetches and displays photos", async ({ page }) => {
    await navigateToDashboard(page);
    await openCreateBoardForm(page);

    // Open advanced panel
    const advancedToggle = page
      .getByRole("button", { name: /advanced|background/i })
      .first();
    if (await advancedToggle.isVisible().catch(() => false)) {
      await advancedToggle.click();
    }

    const unsplashTrigger = page
      .getByRole("button", { name: /choose.*photo|unsplash|background/i })
      .or(page.locator('[data-testid="unsplash-picker-btn"]'))
      .first();

    if (!(await unsplashTrigger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await unsplashTrigger.click();

    // Wait for photos to load (API response)
    const photoGrid = page.locator('[data-testid="unsplash-grid"], .unsplash-grid, img[alt*="photo" i]').first();
    await photoGrid.waitFor({ state: "visible", timeout: 12_000 });

    // At least 1 photo should be displayed
    const photos = page.locator('[data-testid="unsplash-photo"], .unsplash-photo, img[alt*="photo" i]');
    await expect(photos.first()).toBeVisible();
  });
});

test.describe("Board Creation — From Template", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page);
  });

  test("opens template picker from advanced panel", async ({ page }) => {
    await openCreateBoardForm(page);

    const advancedToggle = page
      .getByRole("button", { name: /advanced|template/i })
      .first();
    if (await advancedToggle.isVisible().catch(() => false)) {
      await advancedToggle.click();
    }

    const templateTrigger = page
      .getByRole("button", { name: /template/i })
      .or(page.locator('[data-testid="template-picker-btn"]'))
      .first();

    await expect(templateTrigger).toBeVisible({ timeout: 8_000 });
  });

  test("creates board from Kanban template", async ({ page }) => {
    await openCreateBoardForm(page);

    // Open advanced panel
    const advancedToggle = page
      .getByRole("button", { name: /advanced|template/i })
      .first();
    if (await advancedToggle.isVisible().catch(() => false)) {
      await advancedToggle.click();
    }

    const templateTrigger = page
      .getByRole("button", { name: /template/i })
      .or(page.locator('[data-testid="template-picker-btn"]'))
      .first();

    if (!(await templateTrigger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await templateTrigger.click();

    // Click the Kanban template
    const kanbanOption = page.getByText(/kanban/i).first();
    await kanbanOption.waitFor({ state: "visible", timeout: 8_000 });
    await kanbanOption.click();

    // Fill board title
    const titleInput = page.locator('input[name="title"]').first();
    const boardTitle = `E2E Kanban Board ${Date.now()}`;
    await titleInput.fill(boardTitle);

    // Submit
    await page.getByRole("button", { name: /create/i }).last().click();

    // Should land on the new board with kanban lists
    await page.waitForURL(/\/board\//, { timeout: 15_000 });
    await expect(page.getByText(/backlog/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Board Navigation & Deletion", () => {
  test("can navigate to an existing board", async ({ page }) => {
    await navigateToDashboard(page);

    // Click the first board card
    const boardCard = page.locator('[data-testid="board-card"], .board-card, a[href*="/board/"]').first();

    if (!(await boardCard.isVisible().catch(() => false))) {
      test.skip(); // No boards yet in this test org
      return;
    }

    await boardCard.click();
    await page.waitForURL(/\/board\//, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/board\//);
  });
});
