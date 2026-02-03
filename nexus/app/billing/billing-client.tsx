"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Zap, Crown, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Organization } from "@prisma/client";
import { STRIPE_CONFIG } from "@/lib/stripe";
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
    
    // Handle success/cancel redirects
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    
    if (success) {
      toast.success("Subscription activated successfully!", {
        description: "Welcome to Nexus Pro! Your account has been upgraded.",
      });
      // Clean up URL
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
    } catch (error) {
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
    } catch (error) {
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          Billing & Plans
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Stripe Configuration Warning - Only show after client-side mount */}
      {mounted && !isStripeConfigured && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Stripe Not Configured
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                To enable Pro plan upgrades, you need to configure Stripe with your Price IDs.
              </p>
              <div className="flex gap-2 text-sm">
                <a
                  href="/STRIPE_QUICK_SETUP.md"
                  target="_blank"
                  className="text-amber-900 dark:text-amber-100 underline hover:no-underline font-medium"
                >
                  📖 Quick Setup Guide (5 min)
                </a>
                <span className="text-amber-600">•</span>
                <a
                  href="https://dashboard.stripe.com/test/products"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-900 dark:text-amber-100 underline hover:no-underline font-medium"
                >
                  🔗 Stripe Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-1">
              Current Plan
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              {plan === "FREE" ? "Free Plan" : "Pro Plan"}
              {plan === "PRO" && <Crown className="h-6 w-6 text-yellow-500" />}
            </div>
            {plan === "PRO" && isActive && renewalDate && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Active • Renews on {renewalDate}</span>
              </div>
            )}
            {plan === "PRO" && !isActive && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <XCircle className="h-4 w-4" />
                <span>Inactive • Please check your payment method</span>
              </div>
            )}
          </div>
          {plan === "PRO" && (
            <Button
              onClick={handleManageBilling}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Manage Billing"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Billing Period Toggle */}
      {plan === "FREE" && (
        <div className="flex items-center justify-center gap-4 mb-8">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "outline"}
            onClick={() => setBillingPeriod("monthly")}
            className={billingPeriod === "monthly" ? "bg-indigo-600" : ""}
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "outline"}
            onClick={() => setBillingPeriod("yearly")}
            className={billingPeriod === "yearly" ? "bg-indigo-600" : ""}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
              Save 17%
            </span>
          </Button>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Free</h3>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              $0
              <span className="text-lg font-normal text-slate-600 dark:text-slate-400">/month</span>
            </div>
          </div>

          <ul className="space-y-3 mb-6">
            <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Check className="h-4 w-4 text-green-500" />
              Up to 50 boards
            </li>
            <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Check className="h-4 w-4 text-green-500" />
              500 cards per board
            </li>
            <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Check className="h-4 w-4 text-green-500" />
              Basic collaboration
            </li>
            <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Check className="h-4 w-4 text-green-500" />
              Real-time updates
            </li>
          </ul>

          <Button
            variant="outline"
            disabled={plan === "FREE"}
            className="w-full"
          >
            {plan === "FREE" ? "Current Plan" : "Downgrade"}
          </Button>
        </div>

        {/* Pro Plan */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5" />
              <span className="text-sm font-semibold">POPULAR</span>
            </div>
            
            <h3 className="text-xl font-bold mb-2">Pro</h3>
            <div className="text-3xl font-bold mb-1">
              £{billingPeriod === "monthly" ? "9" : "90"}
              <span className="text-lg font-normal opacity-90">/{billingPeriod === "monthly" ? "month" : "year"}</span>
            </div>
            {billingPeriod === "yearly" && (
              <div className="text-sm opacity-75 mb-6">That's just £7.50/month • Save 17%</div>
            )}
            {billingPeriod === "monthly" && (
              <div className="text-sm opacity-75 mb-6">Billed monthly • Cancel anytime</div>
            )}

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Unlimited boards
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Unlimited cards
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Advanced collaboration
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Priority support
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Custom integrations
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Advanced analytics
              </li>
            </ul>

            <Button
              onClick={plan === "FREE" ? handleUpgrade : handleManageBilling}
              disabled={loading || !isStripeConfigured}
              className="w-full bg-white text-indigo-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : !isStripeConfigured ? (
                "Configure Stripe First"
              ) : plan === "FREE" ? (
                `Upgrade to Pro - £${billingPeriod === "monthly" ? "9/mo" : "90/yr"}`
              ) : (
                "Manage Subscription"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
