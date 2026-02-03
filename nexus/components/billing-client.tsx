"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, Crown, Loader2, Zap, CreditCard, Receipt, Sparkles } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
  isStripeConfigured: boolean;
  priceIds: {
    monthly: string;
    yearly: string;
  };
}

type BillingCycle = "monthly" | "yearly";

export default function BillingClient({ organization, isStripeConfigured, priceIds }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const isPro = organization.subscriptionPlan === "PRO";
  const isActive = organization.stripeSubscriptionStatus === "active";

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);
      
      const priceId = billingCycle === "monthly" ? priceIds.monthly : priceIds.yearly;
      
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

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
      
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      logger.error("Stripe portal redirect failed", { error, context: "portal" });
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#0B0F1A] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      {/* Background Texture */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(135deg, #F0F4FF 0%, #FDF2F8 50%, #FEF3F2 100%)",
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-to-br from-[#7C3AED] to-[#A855F7] rounded-xl opacity-20 blur-lg"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
                Billing & Plans
              </h1>
              <p className="text-[13px] sm:text-[15px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                Manage your subscription and billing information
              </p>
            </div>
          </div>
        </motion.div>

        {/* Current Plan Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border-2 border-[#7C3AED]/20 bg-gradient-to-br from-[#F5F3FF] to-[#FDF2F8] dark:from-[#2E1A2E] dark:to-[#2E1A1F] p-6"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#7C3AED]/10 to-transparent rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {isPro ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#EAB308] flex items-center justify-center shadow-lg">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#7C3AED] uppercase tracking-wider">
                        Current Plan
                      </p>
                      <h2 className="text-2xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        Pro Plan
                      </h2>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-[#E5E7EB] dark:bg-[#252B3A] flex items-center justify-center">
                      <Zap className="h-5 w-5 text-[#64748B] dark:text-[#94A3B8]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#7C3AED] uppercase tracking-wider">
                        Current Plan
                      </p>
                      <h2 className="text-2xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        Free Plan
                      </h2>
                    </div>
                  </>
                )}
              </div>
              
              {isPro && isActive && (
                <div className="px-3 py-1.5 bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-[13px] font-bold rounded-full shadow-md flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Active
                </div>
              )}
            </div>

            {isPro && organization.stripeCurrentPeriodEnd && (
              <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
                Next billing: {format(new Date(organization.stripeCurrentPeriodEnd), "MMMM dd, yyyy")}
              </p>
            )}
          </div>
        </motion.div>

        {/* Billing Toggle */}
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-4 p-1 bg-white dark:bg-[#1A1F2E] border border-[#E5E7EB] dark:border-[#252B3A] rounded-xl">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200",
                  billingCycle === "monthly"
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                    : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A]"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 flex items-center gap-2",
                  billingCycle === "yearly"
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                    : "text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A]"
                )}
              >
                Yearly
                <span className="px-2 py-0.5 bg-[#10B981] text-white text-[11px] font-bold rounded-full transform -rotate-3">
                  Save 17%
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white dark:bg-[#1A1F2E] border-[1.5px] border-[#E5E7EB] dark:border-[#252B3A] rounded-2xl p-8 flex flex-col min-h-[500px]"
          >
            <h3 className="text-2xl font-semibold text-[#0F172A] dark:text-[#F1F5F9] mb-2">
              Free
            </h3>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-bold text-[#0F172A] dark:text-[#F1F5F9]">$0</span>
              <span className="text-lg text-[#64748B] dark:text-[#94A3B8]">/month</span>
            </div>

            <div className="h-px bg-[#E5E7EB] dark:bg-[#252B3A] mb-8" />

            <ul className="space-y-4 flex-1">
              {[
                "5 boards maximum",
                "50 cards per board",
                "Basic activity logs",
                "Community support",
                "Standard templates",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-[#10B981]" />
                  </div>
                  <span className="text-[15px] text-[#475569] dark:text-[#CBD5E1]">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              disabled
              className="w-full h-12 mt-8 bg-[#E5E7EB] dark:bg-[#252B3A] text-[#64748B] dark:text-[#94A3B8] font-medium cursor-not-allowed"
            >
              Current Plan
            </Button>
          </motion.div>

          {/* Pro Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="relative bg-gradient-to-br from-[#7C3AED] to-[#A855F7] rounded-2xl p-8 flex flex-col min-h-[500px] shadow-[0_20px_40px_rgba(124,58,237,0.4)] transform hover:scale-[1.02] transition-transform duration-300"
          >
            {/* Popular Badge */}
            <div className="absolute -top-3 left-8 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#F59E0B]" />
              <span className="text-[12px] font-bold text-[#7C3AED] uppercase tracking-wide">
                Popular
              </span>
            </div>

            <h3 className="text-2xl font-semibold text-white mb-2 mt-4">
              Pro
            </h3>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-bold text-white">
                ${billingCycle === "monthly" ? "9" : "89"}
              </span>
              <span className="text-lg text-white/80">
                /{billingCycle === "monthly" ? "month" : "year"}
              </span>
            </div>

            <div className="h-px bg-white/20 mb-8" />

            <ul className="space-y-4 flex-1">
              {[
                "Unlimited boards",
                "Unlimited cards",
                "Advanced activity logs",
                "Priority support",
                "Custom templates",
                "Team collaboration",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-[15px] text-white font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            {!isPro ? (
              <Button
                onClick={handleUpgrade}
                disabled={isLoading || !isStripeConfigured}
                className="w-full h-12 mt-8 bg-white text-[#7C3AED] hover:bg-white/90 font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Pro - ${billingCycle === "monthly" ? "9/mo" : "89/yr"}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleManageBilling}
                disabled={isLoading}
                className="w-full h-12 mt-8 bg-white text-[#7C3AED] hover:bg-white/90 font-semibold shadow-lg"
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
          </motion.div>
        </div>

        {/* Billing Details Section */}
        {isPro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white dark:bg-[#1A1F2E] border border-[#E5E7EB] dark:border-[#252B3A] rounded-2xl p-8 space-y-6"
          >
            <div className="flex items-center gap-3 pb-6 border-b border-[#E5E7EB] dark:border-[#252B3A]">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Payment Method
              </h2>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#F3F4F6] dark:bg-[#252B3A] flex items-center justify-center mb-4">
                <CreditCard className="h-8 w-8 text-[#64748B] dark:text-[#94A3B8]" />
              </div>
              <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] mb-4">
                Manage payment methods in Stripe
              </p>
              <Button
                onClick={handleManageBilling}
                disabled={isLoading}
                variant="outline"
                className="border-[#E5E7EB] dark:border-[#252B3A] font-medium"
              >
                Open Billing Portal
              </Button>
            </div>

            <div className="pt-6 border-t border-[#E5E7EB] dark:border-[#252B3A]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  Billing History
                </h2>
              </div>

              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#F3F4F6] dark:bg-[#252B3A] flex items-center justify-center mb-4">
                  <Receipt className="h-8 w-8 text-[#64748B] dark:text-[#94A3B8]" />
                </div>
                <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] font-medium mb-1">
                  No billing history yet
                </p>
                <p className="text-[13px] text-[#94A3B8] dark:text-[#64748B]">
                  Your invoices will appear here
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
