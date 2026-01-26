import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap, Users, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const { userId } = await auth();

  // If user is authenticated, redirect to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-10 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        
        <div className="relative z-10 flex flex-col items-center gap-8 max-w-5xl mx-auto text-center">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              NEXUS
            </h1>
          </div>

          {/* Hero Headline */}
          <div className="space-y-4">
            <h2 className="text-6xl font-extrabold leading-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
              Manage Projects Like a Pro
            </h2>
            <p className="text-xl text-slate-600 font-medium max-w-2xl mx-auto">
              The modern task management platform for teams and individuals. 
              <span className="text-indigo-600 font-semibold"> Real-time collaboration</span>, intuitive boards, and powerful workflows.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 mt-4">
            <Link href="/sign-up">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 px-8 py-6 text-lg font-semibold"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button 
                size="lg"
                variant="outline"
                className="border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-8 py-6 text-lg font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
              >
                Sign In
              </Button>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mt-8">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 border-2 border-white" />
              ))}
            </div>
            <span className="font-medium">Join <span className="text-indigo-600 font-bold">10,000+</span> teams worldwide</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-10 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-slate-900 mb-4">
              Everything you need to stay organized
            </h3>
            <p className="text-lg text-slate-600">
              Powerful features to help you manage projects efficiently
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Real-time Collaboration</h4>
              <p className="text-slate-600">
                See changes instantly as your team works together. No refresh needed with WebSocket-powered updates.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Team Workspaces</h4>
              <p className="text-slate-600">
                Create multiple boards for different projects. Invite team members and collaborate seamlessly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Secure & Private</h4>
              <p className="text-slate-600">
                Enterprise-grade security with role-based access control. Your data is always protected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-10 bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h3 className="text-4xl font-bold text-slate-900">
                Why teams choose Nexus
              </h3>
              <ul className="space-y-4">
                {[
                  "Drag & drop cards between lists effortlessly",
                  "Real-time presence tracking - see who's online",
                  "Detailed activity logs for complete transparency",
                  "Priority levels and custom labels for organization",
                  "Flexible board templates for any workflow",
                  "Mobile-responsive design works everywhere"
                ].map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl transform rotate-3 transition-transform hover:rotate-6" />
              <div className="absolute inset-0 aspect-square rounded-2xl bg-white shadow-xl p-8 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    100%
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    Free to Start
                  </div>
                  <p className="text-slate-600">
                    No credit card required
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-10 bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h3 className="text-5xl font-bold text-white">
            Ready to get organized?
          </h3>
          <p className="text-xl text-indigo-100">
            Join thousands of teams already using Nexus to manage their projects
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/sign-up">
              <Button 
                size="lg"
                className="bg-white text-indigo-600 hover:bg-slate-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 px-8 py-6 text-lg font-semibold"
              >
                Start Free Today
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-indigo-200">
            No credit card required • Free forever • Upgrade anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-10 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">NEXUS</span>
          </div>
          <p className="text-sm">
            © 2026 Nexus. Built with Next.js, Prisma, and Supabase.
          </p>
        </div>
      </footer>
    </div>
  );
}