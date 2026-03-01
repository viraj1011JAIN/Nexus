import Link from "next/link";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pending Approval Page
 *
 * Shown to users whose org membership status is PENDING.
 * The proxy.ts middleware redirects here when it detects
 * `publicMetadata.orgMembershipStatus === "PENDING"`.
 *
 * The real enforcement happens in getTenantContext() which blocks
 * PENDING users from all role-gated operations. This page is purely
 * a UX improvement so users understand what's happening.
 */
export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

      <div className="max-w-md w-full text-center relative z-10 glass-effect rounded-2xl p-8 shadow-xl border-2 border-white/20 animate-fadeInUp">
        {/* Logo */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
            NEXUS
          </h1>
        </div>

        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Membership Pending
        </h2>
        <p className="text-slate-600 mb-2">
          Your request to join this organisation is awaiting approval from an admin.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          You&apos;ll get access as soon as an organisation admin approves your
          request. You can check back later or contact your admin directly.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Link href="/pending-approval">
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Status
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="border-slate-300 hover:bg-slate-100 transition-all"
          >
            <Link href="/select-org">
              <LogOut className="h-4 w-4 mr-2" />
              Switch Organisation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
