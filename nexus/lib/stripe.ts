import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// At build time (static analysis pass) STRIPE_SECRET_KEY is not set; that is fine.
// At request time in production it MUST be set — throw clearly rather than
// silently authenticating with a dummy key and getting 401s from Stripe.
if (!stripeSecretKey && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error(
    "[stripe] STRIPE_SECRET_KEY is not set. " +
    "Add it to your environment variables before starting the production server."
  );
}

export const stripe = new Stripe(stripeSecretKey ?? "sk_test_placeholder_build_only", {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Stripe Product Configuration (UK/GBP)
export const STRIPE_CONFIG = {
  // Stripe Price IDs - Replace with your actual IDs from Stripe Dashboard
  // See STRIPE_SETUP_UK.md for setup instructions
  prices: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
    },
  },
  
  // Currency and locale settings for UK
  currency: "gbp" as const,
  locale: "en-GB" as const,
  
  // Plan limits
  limits: {
    FREE: {
      boards: 50,  // Increased for testing
      cardsPerBoard: 500,  // Increased for testing
    },
    PRO: {
      boards: Infinity,
      cardsPerBoard: Infinity,
    },
  },
  
  // Pricing for display
  pricing: {
    monthly: 9,
    yearly: 90,
    currency: "£",
  },
} as const;

// Helper to check if Stripe is configured
export const isStripeConfigured = () => {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID &&
    process.env.STRIPE_PRO_YEARLY_PRICE_ID
  );
};
