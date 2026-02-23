/**
 * Auth Setup – User B
 *
 * Saves an authenticated session for a second test user (belonging to a
 * different organisation than User A) to `e2e/.auth/userB.json`.
 *
 * Required environment variables:
 *   E2E_USER_B_EMAIL     – clerk account email for second test user
 *   E2E_USER_B_PASSWORD  – clerk account password for second test user
 *
 * Both variables must be set and the account must exist for tenant-isolation
 * specs to run.  When the variables are absent the tests that depend on this
 * auth state are automatically skipped (see tenant-isolation.spec.ts).
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth", "userB.json");
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

setup("Authenticate as User B (second organisation)", async ({ page }) => {
  const email = process.env.E2E_USER_B_EMAIL;
  const password = process.env.E2E_USER_B_PASSWORD;

  if (!email || !password) {
    console.warn(
      "[auth-user-b] E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD not set – skipping User B auth setup."
    );
    // Write an empty storage state so dependent projects don't crash
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  await page.goto(`${BASE}/sign-in`);

  // Clerk renders a single email field first, then a password field
  await page.locator('input[name="identifier"]').fill(email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to the dashboard which confirms successful auth
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 });
  await expect(page).toHaveURL(/dashboard/);

  await page.context().storageState({ path: AUTH_FILE });
});
