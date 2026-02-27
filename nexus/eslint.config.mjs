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
  // app/layout.tsx may embed third-party <link> CSS tags and synchronous
  // tracking/analytics scripts that Next.js rules flag globally.
  {
    files: ["app/**/layout.tsx", "app/**/layout.ts"],
    rules: {
      "@next/next/no-css-tags":      "off",
      "@next/next/no-sync-scripts":  "off",
      "@next/next/inline-script-id": "off",
    },
  },
  // SVG icons and animation components use custom HTML attributes (e.g. fill,
  // stroke-width) that React's prop-types checker doesn't recognise.
  {
    files: ["components/**/*.tsx", "app/**/*.tsx"],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
  // Email template files use styled-jsx for inline <style> blocks that are
  // only rendered server-side and cannot use the Next.js <Head> API.
  {
    files: ["emails/**/*.ts", "emails/**/*.tsx"],
    rules: {
      "@next/next/no-styled-jsx-in-document": "off",
    },
  },
]);

export default eslintConfig;
