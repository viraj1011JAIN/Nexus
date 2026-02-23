/**
 * Auth Setup — runs ONCE and saves cookies/localStorage to e2e/.auth/user.json
 * so all other test files can re-use the authenticated session without re-logging in.
 *
 * This file is deliberately *not* run by the main test suites — it is a setup
 * project in playwright.config.ts (testMatch: '**/auth.setup.ts').
 *
 * Environment variables consumed:
 *   E2E_EMAIL     — test user email (created in Clerk dev dashboard)
 *   E2E_PASSWORD  — test user password
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  // Ensure directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const email = process.env.E2E_EMAIL ?? "test@nexus-e2e.dev";
  const password = process.env.E2E_PASSWORD ?? "TestPassword123!";

  await page.goto("/sign-in");

  // Wait for Clerk's sign-in form to render
  await page.waitForSelector('[data-testid="sign-in-form"], input[name="identifier"], input[type="email"]', {
    timeout: 15_000,
  });

  // Fill identifier (email)
  const identifier = page
    .locator('input[name="identifier"]')
    .or(page.locator('input[type="email"]'))
    .first();
  await identifier.fill(email);

  // Press continue / next button if it exists (Clerk 2-step)
  const continueBtn = page.locator('button[type="submit"]').or(page.getByRole("button", { name: /continue/i })).first();
  await continueBtn.click();

  // Fill password
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
  await passwordInput.fill(password);

  // Submit
  const signInBtn = page.getByRole("button", { name: /sign in/i }).or(page.locator('button[type="submit"]')).last();
  await signInBtn.click();

  // Wait for successful redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard/);

  // Persist auth state
  await page.context().storageState({ path: AUTH_FILE });
});
