"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, X } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardCount: number;
  boardLimit: number;
}

export function ProUpgradeModal({
  isOpen,
  onClose,
  currentBoardCount,
  boardLimit,
}: ProUpgradeModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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
      logger.error("Pro upgrade failed", { error });
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md glass-effect border-2 border-white/20 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-x-2 text-2xl font-bold bg-linear-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              <Crown className="h-6 w-6 text-amber-500 animate-pulse" />
              Upgrade to Pro
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <DialogDescription>
            You&apos;ve reached your board limit ({currentBoardCount}/{boardLimit})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pricing */}
          <div className="relative text-center p-8 bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl overflow-hidden">
            {/* Animated shine */}
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-baseline justify-center gap-x-2 mb-3">
                <span className="text-5xl font-bold text-white">$9</span>
                <span className="text-white/80 font-medium">/month</span>
              </div>
              <p className="text-sm text-white/90 font-medium">
                Cancel anytime. No hidden fees.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {[
              "Unlimited boards",
              "Unlimited cards per board",
              "Advanced activity logs",
              "Priority support",
              "Custom board templates",
              "Team collaboration tools",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-x-3 group">
                <div className="shrink-0 w-6 h-6 bg-linear-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Check className="h-3.5 w-3.5 text-indigo-600 font-bold" />
                </div>
                <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 transition-colors">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 font-bold"
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
                  Upgrade Now
                </>
              )}
            </Button>
            
            <Button
              onClick={() => router.push("/billing")}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              View Pricing Details
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="pt-4 border-t">
            <p className="text-xs text-center text-slate-500">
              Secure payment powered by Stripe • 14-day money-back guarantee
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
