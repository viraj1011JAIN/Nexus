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

// Stripe Product Configuration
export const STRIPE_CONFIG = {
  // Replace these with your actual Stripe Price IDs after creating products in Stripe Dashboard
  prices: {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly",
    },
  },
  
  // Plan limits
  limits: {
    FREE: {
      boards: 5,
      cardsPerBoard: 50,
    },
    PRO: {
      boards: Infinity,
      cardsPerBoard: Infinity,
    },
  },
} as const;
