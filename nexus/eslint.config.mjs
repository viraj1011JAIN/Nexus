import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated coverage reports
    "coverage/**",
    // Playwright E2E — linted separately via e2e/tsconfig.json
    "e2e/**",
    "playwright.config.ts",
    "playwright-report/**",
  ]),
  // ── Security: ban systemDb outside privileged routes ─────────────────────
  // systemDb uses the Supabase service role (SYSTEM_DATABASE_URL) and bypasses
  // ALL Row-Level Security policies. It must never appear in server actions or
  // user-triggered API routes. Only webhook handlers and cron jobs may import it.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              importNames: ["systemDb"],
              message:
                "systemDb bypasses Row-Level Security. Only import it in app/api/webhook/ or app/api/cron/. See lib/db.ts.",
            },
          ],
        },
      ],
    },
  },
  // Allowlist: webhook and cron route files may use systemDb
  {
    files: ["app/api/webhook/**/*.ts", "app/api/cron/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Allow underscore-prefixed variables to be "intentionally unused"
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
