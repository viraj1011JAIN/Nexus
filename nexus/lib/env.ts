/**
 * Environment Variable Validation
 *
 * Validates that all required environment variables are present at startup.
 * Import this file in server entrypoints (layout.tsx, API routes) to surface
 * configuration errors early rather than getting cryptic runtime failures.
 *
 * Call validateEnv() at module level — it runs once and throws clearly if
 * anything critical is missing.
 */

import "server-only";

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Auth
  { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true, description: "Clerk publishable key" },
  { key: "CLERK_SECRET_KEY", required: true, description: "Clerk secret key" },

  // Database
  { key: "DATABASE_URL", required: true, description: "Prisma database URL (pooled)" },
  { key: "DIRECT_URL", required: true, description: "Prisma direct database URL" },

  // App URL
  { key: "NEXT_PUBLIC_APP_URL", required: true, description: "Public app URL (e.g. https://nexus.example.com)" },

  // Stripe
  { key: "STRIPE_SECRET_KEY", required: false, description: "Stripe secret key (required for billing)" },
  { key: "STRIPE_WEBHOOK_SECRET", required: false, description: "Stripe webhook signing secret" },
  { key: "STRIPE_PRO_MONTHLY_PRICE_ID", required: false, description: "Stripe Pro monthly price ID" },
  { key: "STRIPE_PRO_YEARLY_PRICE_ID", required: false, description: "Stripe Pro yearly price ID" },

  // Supabase
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: false, description: "Supabase project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: false, description: "Supabase anon key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: false, description: "Supabase service role key (file uploads)" },

  // Cron
  { key: "CRON_SECRET", required: false, description: "Secret for cron job authorization" },

  // Email
  { key: "RESEND_API_KEY", required: false, description: "Resend API key for transactional email" },
];

// Use globalThis so the flag persists across Turbopack HMR module
// re-evaluations. A plain module-level `let` is reset every time the module
// is re-evaluated (which Turbopack does per HMR cycle in dev).
const g = globalThis as typeof globalThis & { __nexusEnvValidated?: boolean };

export function validateEnv(): void {
  // Only validate once per Node.js process — not once per module evaluation
  if (g.__nexusEnvValidated) return;
  g.__nexusEnvValidated = true;

  // Don't run during static build analysis
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const { key, required, description } of ENV_VARS) {
    const value = process.env[key];
    const isEmpty = !value || value.includes("your_") || value.includes("_here") || value.includes("placeholder");

    if (isEmpty) {
      if (required) {
        missing.push(`  ✗ ${key} — ${description}`);
      } else {
        warnings.push(`  ⚠ ${key} — ${description} (optional, feature disabled)`);
      }
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      `[env] Optional environment variables not set:\n${warnings.join("\n")}\n` +
      `These features will be disabled or limited.`
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n${missing.join("\n")}\n\n` +
      `Copy .env.example to .env.local and fill in the missing values.`
    );
  }
}
