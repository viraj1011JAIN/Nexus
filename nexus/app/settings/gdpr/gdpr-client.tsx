"use client";

import { useState } from "react";
import type { ElementType } from "react";
import { toast } from "sonner";
import { Download, Trash2, Shield, Cookie, FileText, AlertTriangle, CheckCircle2, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GdprClientProps {
  userEmail: string;
  userName: string;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = "secondary",
  children,
}: {
  icon: ElementType;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "secondary" | "destructive" | "outline";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="pl-14">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GdprClient({ userEmail, userName }: GdprClientProps) {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<Record<string, boolean>>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  // ── Data Export ─────────────────────────────────────────────────────────────

  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/gdpr/export", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation so Safari has time to initiate the download
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Your data export has been downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export data. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  // ── Deletion Request ─────────────────────────────────────────────────────────

  const handleDeletionRequest = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/gdpr/delete-request", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      setDeleteRequested(true);
      setConfirmDelete(false);
      toast.success("Your deletion request has been submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit deletion request.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Cookie Consent ──────────────────────────────────────────────────────────

  const handleCookieSave = () => {
    // Persist via a cookie/localStorage — in production wire to your consent management platform
    if (typeof window !== "undefined") {
      localStorage.setItem("nexus_cookie_consent", JSON.stringify(cookieConsent));
    }
    toast.success("Cookie preferences saved.");
  };

  const cookieCategories = [
    {
      key: "necessary",
      label: "Strictly Necessary",
      description: "Session cookies, CSRF tokens, and authentication — required for the service to function.",
      required: true,
    },
    {
      key: "analytics",
      label: "Analytics",
      description: "Anonymous usage data that helps us improve performance and features.",
      required: false,
    },
    {
      key: "marketing",
      label: "Marketing",
      description: "Personalised product communications and third-party advertising.",
      required: false,
    },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8 px-4">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Privacy & Data Rights</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal data in accordance with GDPR and applicable privacy law.
          </p>
        </div>
      </div>

      {/* Identity summary */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          Data controller for account <span className="font-semibold text-foreground">{userEmail}</span>
          {userName ? ` (${userName})` : ""}.
        </p>
      </div>

      {/* 1 — Data Export */}
      <SectionCard
        icon={Download}
        title="Export Your Data"
        description="Download a machine-readable copy of all personal data we hold about you, including your profile, boards, cards, comments, and audit logs. Article 20 GDPR."
        badge="Right to Portability"
      >
        <Button
          onClick={handleDataExport}
          disabled={exportLoading}
          variant="outline"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {exportLoading ? "Preparing export…" : "Download My Data (JSON)"}
        </Button>
      </SectionCard>

      {/* 2 — Data Deletion */}
      <SectionCard
        icon={Trash2}
        title="Delete Your Account & Data"
        description="Request permanent deletion of your account and all associated personal data. Processing takes up to 30 days. This action cannot be undone."
        badge="Right to Erasure"
        badgeVariant="destructive"
      >
        {deleteRequested ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Deletion request submitted. Check your email for confirmation.
          </div>
        ) : (
          <div className="space-y-3">
            {confirmDelete && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  This will permanently delete your account, boards, cards, comments, and all other personal data.
                  The request will be queued and completed within 30 days — you will receive a confirmation once processing begins.
                </span>
              </div>
            )}
            <Button
              onClick={handleDeletionRequest}
              disabled={deleteLoading}
              variant={confirmDelete ? "destructive" : "outline"}
              className={cn("gap-2", !confirmDelete && "text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20")}
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? "Confirm — Delete My Account" : "Request Account Deletion"}
            </Button>
            {confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* 3 — Cookie Preferences */}
      <SectionCard
        icon={Cookie}
        title="Cookie Preferences"
        description="Control which cookies and tracking technologies are active on your account. Strictly necessary cookies cannot be disabled."
      >
        <div className="space-y-3">
          {cookieCategories.map((cat) => (
            <label
              key={cat.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                cat.required
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                  : "border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-indigo-500 flex-shrink-0"
                checked={cookieConsent[cat.key]}
                disabled={cat.required}
                onChange={(e) =>
                  setCookieConsent((prev) => ({ ...prev, [cat.key]: e.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  {cat.label}
                  {cat.required && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">Required</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
            </label>
          ))}
          <Button size="sm" onClick={handleCookieSave} className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save Preferences
          </Button>
        </div>
      </SectionCard>

      {/* 4 — Legal documents */}
      <SectionCard
        icon={FileText}
        title="Legal Documents"
        description="Review the policies governing how your data is collected, processed, and protected."
      >
        <div className="space-y-2">
          {[
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "Cookie Policy", href: "/cookies" },
            { label: "Data Processing Agreement (DPA)", href: "/dpa" },
          ].map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {doc.label}
            </a>
          ))}
        </div>
      </SectionCard>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        For any privacy concerns not covered here, contact{" "}
        <a href="mailto:privacy@nexus.app" className="text-indigo-500 hover:underline">
          privacy@nexus.app
        </a>
        . We respond to all requests within 30 days as required by GDPR Article 12.
      </p>
    </div>
  );
}
