"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      <div className="max-w-md w-full text-center relative z-10 glass-effect rounded-2xl p-8 shadow-xl border-2 border-white/20 animate-fadeInUp">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">NEXUS</h1>
        </div>

        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold bg-gradient-to-br from-slate-200 to-slate-300 bg-clip-text text-transparent">404</div>
          <Search className="h-24 w-24 text-indigo-300 mx-auto -mt-12" />
        </div>

        {/* Message */}
        <h2 className="text-3xl font-bold text-slate-900 mb-3">
          Page Not Found
        </h2>
        <p className="text-slate-600 mb-8">
          Sorry, we couldn't find the page you're looking for. 
          The board or resource may have been moved or deleted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Link>
          </Button>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
          >
            Go Back
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-slate-600 mt-8 font-medium">
          Need help? Contact support or check your board permissions.
        </p>
      </div>
    </div>
  );
}
