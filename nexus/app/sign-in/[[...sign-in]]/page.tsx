"use client";

import { SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_ORG_ID } from "@/hooks/use-demo-mode";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleGuestDemo = async () => {
    setIsDemoLoading(true);
    
    try {
      // Set session flag for demo mode
      sessionStorage.setItem("demo-mode", "true");
      sessionStorage.setItem("demo-start-time", Date.now().toString());
      
      // Track demo usage
      if (typeof window !== "undefined" && (window as any).analytics) {
        (window as any).analytics.track("Guest Demo Started", {
          timestamp: new Date().toISOString(),
          source: "sign-in-page",
        });
      }
      
      // Navigate to demo board
      router.push(`/organization/${DEMO_ORG_ID}`);
    } catch (error) {
      console.error("Error starting demo:", error);
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-fadeInUp">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-600 font-medium">
            Sign in to continue to NEXUS
          </p>
        </div>
        
        <div className="glass-effect rounded-2xl p-8 shadow-2xl border-2 border-white/20 animate-scaleIn">
          <SignIn 
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            afterSignInUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none",
                headerTitle: "text-2xl font-bold text-slate-800",
                headerSubtitle: "text-slate-600",
                socialButtonsBlockButton: "glass-effect border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all",
                formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105 active:scale-95",
                formFieldInput: "border-slate-200 focus:border-indigo-400 focus:ring-indigo-400",
                footerActionLink: "text-indigo-600 hover:text-purple-600",
              },
            }}
          />
          
          {/* Demo Mode Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/80 px-3 py-1 text-slate-500 font-semibold rounded-full">
                or try guest mode
              </span>
            </div>
          </div>

          {/* Guest Demo Button */}
          <Button 
            onClick={handleGuestDemo}
            disabled={isDemoLoading}
            size="lg"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDemoLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Loading Demo...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">🎯</span>
                <span>View Demo (No Signup Required)</span>
              </div>
            )}
          </Button>

          {/* Demo Info */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800 text-center">
              <strong className="font-semibold">Guest Mode:</strong> Explore all features with sample data. 
              <br />
              Changes are not saved. Sign up to create your own workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
