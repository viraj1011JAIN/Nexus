"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, Crown, Loader2, Zap } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { stripe } from "@/lib/stripe";

interface BillingClientProps {
  organization: {
    id: string;
    name: string;
    subscriptionPlan: string;
    stripeCustomerId: string | null;
    stripeSubscriptionStatus: string | null;
    stripeCurrentPeriodEnd: Date | null;
    boardCount: number;
  };
}

export function BillingClient({ organization }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPro = organization.subscriptionPlan === "PRO";
  const isActive = organization.stripeSubscriptionStatus === "active";

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);
      
      // Call checkout API
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      logger.error("Stripe checkout failed", { error, context: "upgrade" });
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setIsLoading(true);
      
      // Create customer portal session
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error) {
      logger.error("Stripe portal redirect failed", { error, context: "portal" });
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-8 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="animate-fadeInUp">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">Billing & Subscription</h1>
          <p className="text-slate-700 font-medium">
            Manage your subscription and billing information for {organization.name}
          </p>
        </div>

        {/* Current Plan Card */}
        <div className="glass-effect rounded-2xl border-2 border-white/20 shadow-xl p-8 animate-fadeInUp" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-x-3">
              {isPro ? (
                <div className="flex items-center gap-x-3">
                  <div className="p-3 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl shadow-lg">
                    <Crown className="h-7 w-7 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">Pro Plan</h2>
                </div>
              ) : (
                <div className="flex items-center gap-x-3">
                  <div className="p-3 bg-slate-100 rounded-2xl">
                    <Zap className="h-7 w-7 text-slate-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-700">Free Plan</h2>
                </div>
              )}
          </div>
          
            {isPro && isActive && (
              <span className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-sm font-bold rounded-full shadow-lg animate-pulse">
                Active
              </span>
            )}
          </div>

          {/* Plan Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between py-3 border-b border-slate-200/50">
              <span className="text-slate-600 font-medium">Boards</span>
              <span className="font-bold text-slate-900 text-lg">
                {organization.boardCount} / {isPro ? "Unlimited" : "5"}
              </span>
            </div>
          
            {isPro && organization.stripeCurrentPeriodEnd && (
              <div className="flex items-center justify-between py-3 border-b border-slate-200/50">
                <span className="text-slate-600 font-medium">Next billing date</span>
                <span className="font-bold text-slate-900">
                  {format(new Date(organization.stripeCurrentPeriodEnd), "MMMM dd, yyyy")}
                </span>
              </div>
            )}

            {!isPro && (
              <div className="flex items-center justify-between py-3 border-b border-slate-200/50">
                <span className="text-slate-600 font-medium">Storage per board</span>
                <span className="font-bold text-slate-900">50 cards</span>
              </div>
            )}
          </div>

          {/* CTA Buttons */}
          {!isPro ? (
            <Button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-bold"
              size="lg"
            >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </>
            )}
          </Button>
          ) : (
            <Button
              onClick={handleManageBilling}
              disabled={isLoading}
              variant="outline"
              className="w-full border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all font-semibold"
              size="lg"
            >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Manage Billing"
            )}
          </Button>
        )}
      </div>

        {/* Pro Features */}
        {!isPro && (
          <div className="relative glass-effect rounded-2xl border-2 border-white/20 shadow-xl p-8 overflow-hidden animate-fadeInUp" style={{animationDelay: '0.2s'}}>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-x-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl shadow-lg">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Pro Features</h3>
              </div>
          
              <ul className="space-y-4 mb-8">
                {[
                  "Unlimited boards",
                  "Unlimited cards per board",
                  "Advanced activity logs",
                  "Priority support",
                  "Custom board templates",
                  "Team collaboration tools",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-x-3 group">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg group-hover:scale-110 transition-transform">
                      <Check className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="text-slate-800 font-medium group-hover:text-slate-900 transition-colors">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-6 border-t border-white/20">
                <div className="p-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-lg">
                  <div className="flex items-baseline gap-x-2 mb-2">
                    <span className="text-5xl font-bold text-white">$9</span>
                    <span className="text-white/90 font-medium text-lg">/month</span>
                  </div>
                  <p className="text-sm text-white/90 font-medium">
                    Cancel anytime. No hidden fees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
