"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Zap, Crown, Loader2, CheckCircle, XCircle, Sparkles, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Organization } from "@prisma/client";
import { useSearchParams } from "next/navigation";

export default function BillingClient({ 
  organization,
  isStripeConfigured: isStripeConfiguredProp = true,
  priceIds 
}: { 
  organization: Organization;
  isStripeConfigured?: boolean;
  priceIds: { monthly: string; yearly: string };
}) {
  const [loading, setLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const plan = organization.subscriptionPlan;

  useEffect(() => {
    setMounted(true);
    
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    
    if (success) {
      toast.success("Subscription activated successfully!", {
        description: "Welcome to Nexus Pro! Your account has been upgraded.",
      });
      window.history.replaceState({}, "", "/billing");
    }
    
    if (canceled) {
      toast.info("Checkout canceled", {
        description: "You can upgrade anytime from this page.",
      });
      window.history.replaceState({}, "", "/billing");
    }
  }, [searchParams]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const priceId = billingPeriod === "monthly" 
        ? priceIds.monthly
        : priceIds.yearly;
      
      if (!priceId) {
        toast.error("Stripe not configured", {
          description: "Please contact support to set up billing. Check STRIPE_SETUP_UK.md for instructions.",
        });
        setLoading(false);
        return;
      }
      
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      
      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to start checkout", {
          description: "Please check your Stripe configuration or contact support.",
        });
      }
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again or contact support.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      
      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      } else {
        toast.error("Failed to open billing portal");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isActive = organization.stripeSubscriptionStatus === "active";
  const renewalDate = formatDate(organization.stripeCurrentPeriodEnd);
  const isStripeConfigured = isStripeConfiguredProp;

  // Single source of truth for currency display
  const CURRENCY_SYMBOL = "£";
  const formatPrice = (amount: number) => `${CURRENCY_SYMBOL}${amount}`;

  const freeFeatures = [
    "Up to 50 boards",
    "500 cards per board",
    "Basic collaboration",
    "Real-time updates",
    "Community support",
  ];

  const proFeatures = [
    "Unlimited boards",
    "Unlimited cards",
    "Advanced collaboration",
    "Priority support",
    "Custom integrations",
    "Advanced analytics",
    "AI-powered suggestions",
    "Custom automation rules",
  ];

  return (
    <div className={`max-w-[1000px] mx-auto px-4 sm:px-6 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[12px]"}`}>
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-[44px] h-[44px] rounded-[12px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <CreditCard className="h-[22px] w-[22px] text-white" />
          </div>
          <div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-slate-900 dark:text-white">
              Billing & Plans
            </h1>
            <p className="text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400">
              Manage your subscription and billing
            </p>
          </div>
        </div>
      </div>

      {/* Stripe Configuration Warning */}
      {mounted && !isStripeConfigured && (
        <div className="mb-8 rounded-[16px] bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/[0.15] p-5 animate-auth-fade-up">
          <div className="flex items-start gap-3">
            <div className="w-[36px] h-[36px] rounded-[10px] bg-amber-100 dark:bg-amber-500/[0.12] flex items-center justify-center shrink-0">
              <XCircle className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-[15px] mb-1">
                Stripe Not Configured
              </h3>
              <p className="text-[13px] text-amber-800 dark:text-amber-300/80 mb-3">
                To enable Pro plan upgrades, you need to configure Stripe with your Price IDs.
              </p>
              <div className="flex items-center gap-3 text-[13px]">
                <a
                  href="/STRIPE_QUICK_SETUP.md"
                  target="_blank"
                  className="text-amber-900 dark:text-amber-200 underline hover:no-underline font-medium inline-flex items-center gap-1"
                >
                  📖 Quick Setup Guide
                </a>
                <span className="text-amber-400">•</span>
                <a
                  href="https://dashboard.stripe.com/test/products"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-900 dark:text-amber-200 underline hover:no-underline font-medium inline-flex items-center gap-1"
                >
                  🔗 Stripe Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Status Card */}
      <div className="relative rounded-[20px] overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 p-[1px] mb-8 animate-auth-fade-up" style={{ animationDelay: "100ms" }}>
        <div className="rounded-[19px] bg-gradient-to-br from-indigo-600/95 via-purple-600/95 to-violet-700/95 backdrop-blur-xl p-6 sm:p-7">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-white/[0.06] rounded-full -mr-[80px] -mt-[80px]" />
          <div className="absolute bottom-0 left-0 w-[120px] h-[120px] bg-white/[0.04] rounded-full -ml-[50px] -mb-[50px]" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-[12px] font-medium text-white/60 uppercase tracking-wider mb-1.5">
                Current Plan
              </div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-[26px] sm:text-[30px] font-bold text-white">
                  {plan === "FREE" ? "Free" : "Pro"}
                </span>
                {plan === "PRO" && (
                  <div className="w-[28px] h-[28px] rounded-full bg-yellow-400/20 flex items-center justify-center">
                    <Crown className="h-[16px] w-[16px] text-yellow-300" />
                  </div>
                )}
              </div>
              {plan === "PRO" && isActive && renewalDate && (
                <div className="flex items-center gap-2 text-[13px] text-white/70">
                  <CheckCircle className="h-[14px] w-[14px] text-emerald-300" />
                  <span>Active • Renews on {renewalDate}</span>
                </div>
              )}
              {plan === "PRO" && !isActive && (
                <div className="flex items-center gap-2 text-[13px] text-amber-200">
                  <XCircle className="h-[14px] w-[14px]" />
                  <span>Inactive • Please check your payment method</span>
                </div>
              )}
              {plan === "FREE" && (
                <p className="text-[13px] text-white/60">
                  Upgrade to Pro to unlock all features
                </p>
              )}
            </div>
            {plan === "PRO" && (
              <Button
                onClick={handleManageBilling}
                disabled={loading}
                className="bg-white/[0.15] hover:bg-white/[0.2] text-white border border-white/[0.2] rounded-[12px] min-h-[42px] px-5 transition-all duration-200 backdrop-blur-sm"
              >
                {loading ? (
                  <Loader2 className="h-[16px] w-[16px] animate-spin" />
                ) : (
                  <>
                    Manage Billing
                    <ArrowRight className="h-[14px] w-[14px] ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Billing Period Toggle */}
      {plan === "FREE" && (
        <div className="flex items-center justify-center gap-2 mb-8 animate-auth-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="inline-flex items-center rounded-[14px] bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] p-[4px]">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`relative px-5 py-2.5 rounded-[11px] text-[13px] font-semibold transition-all duration-300 ${
                billingPeriod === "monthly"
                  ? "bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`relative px-5 py-2.5 rounded-[11px] text-[13px] font-semibold transition-all duration-300 flex items-center gap-2 ${
                billingPeriod === "yearly"
                  ? "bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Yearly
              <span className="text-[10px] font-bold bg-emerald-500 text-white px-[8px] py-[2px] rounded-full">
                -17%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-5 sm:gap-6 animate-auth-fade-up" style={{ animationDelay: "300ms" }}>
        {/* Free Plan */}
        <div className="relative rounded-[20px] bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] p-6 sm:p-7 transition-all duration-300 hover:border-slate-300 dark:hover:border-white/[0.12] group">
          <div className="mb-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
                <Shield className="h-[18px] w-[18px] text-slate-500 dark:text-slate-400" />
              </div>
              <h3 className="text-[20px] font-bold text-slate-900 dark:text-white">Free</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[42px] font-bold text-slate-900 dark:text-white tracking-tight">{formatPrice(0)}</span>
              <span className="text-[15px] text-slate-500 dark:text-slate-400 font-medium">/month</span>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5">
              Perfect for personal projects
            </p>
          </div>

          <ul className="space-y-3 mb-7">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                <div className="w-[20px] h-[20px] rounded-full bg-emerald-100 dark:bg-emerald-500/[0.12] flex items-center justify-center shrink-0">
                  <Check className="h-[12px] w-[12px] text-emerald-600 dark:text-emerald-400" />
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <Button
            variant="outline"
            disabled={plan === "FREE" || loading}
            onClick={plan !== "FREE" ? handleManageBilling : undefined}
            className="w-full rounded-[12px] min-h-[44px] text-[14px] font-semibold border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all duration-200"
          >
            {plan === "FREE" ? (
              "Current Plan"
            ) : loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-[16px] w-[16px] animate-spin" />
                Processing...
              </div>
            ) : (
              "Manage / Downgrade"
            )}
          </Button>
        </div>

        {/* Pro Plan */}
        <div className="relative rounded-[20px] overflow-hidden">
          {/* Animated gradient border */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-600 rounded-[20px] p-[1.5px]">
            <div className="w-full h-full bg-white dark:bg-[#0D0C14] rounded-[19px]" />
          </div>

          <div className="relative p-6 sm:p-7">
            {/* Popular badge */}
            <div className="absolute top-5 right-5">
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg shadow-purple-500/25">
                <Sparkles className="h-[12px] w-[12px]" />
                Popular
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Zap className="h-[18px] w-[18px] text-white" />
                </div>
                <h3 className="text-[20px] font-bold text-slate-900 dark:text-white">Pro</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[42px] font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatPrice(billingPeriod === "monthly" ? 9 : 90)}
                </span>
                <span className="text-[15px] text-slate-500 dark:text-slate-400 font-medium">
                  /{billingPeriod === "monthly" ? "month" : "year"}
                </span>
              </div>
              {billingPeriod === "yearly" ? (
                <p className="text-[13px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  That&apos;s just {CURRENCY_SYMBOL}7.50/month — Save 17%
                </p>
              ) : (
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Billed monthly • Cancel anytime
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-7">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[14px] text-slate-600 dark:text-slate-300">
                  <div className="w-[20px] h-[20px] rounded-full bg-purple-100 dark:bg-purple-500/[0.12] flex items-center justify-center shrink-0">
                    <Check className="h-[12px] w-[12px] text-purple-600 dark:text-purple-400" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              onClick={plan === "FREE" ? handleUpgrade : handleManageBilling}
              disabled={loading || !isStripeConfigured}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-[12px] min-h-[44px] text-[14px] font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-[16px] w-[16px] animate-spin" />
                  Processing...
                </div>
              ) : !isStripeConfigured ? (
                "Configure Stripe First"
              ) : plan === "FREE" ? (
                <div className="flex items-center gap-2">
                  <span>Upgrade to Pro — {CURRENCY_SYMBOL}{billingPeriod === "monthly" ? "9/mo" : "90/yr"}</span>
                  <ArrowRight className="h-[14px] w-[14px]" />
                </div>
              ) : (
                "Manage Subscription"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[12px] text-slate-400 dark:text-slate-500 animate-auth-fade-up" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center gap-1.5">
          <Shield className="h-[14px] w-[14px]" />
          <span>256-bit SSL encryption</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-[14px] w-[14px]" />
          <span>Cancel anytime</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-[14px] w-[14px]" />
          <span>Powered by Stripe</span>
        </div>
      </div>
    </div>
  );
}
