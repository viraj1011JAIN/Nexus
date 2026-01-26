import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  // During build time, use a dummy key to allow static analysis
  if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
    console.warn("STRIPE_SECRET_KEY not set during build - Stripe functionality will fail at runtime");
  }
}

export const stripe = new Stripe(stripeSecretKey || "sk_test_dummy_key_for_build", {
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
