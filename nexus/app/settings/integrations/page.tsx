/**
 * TASK-027 — Integrations Hub Settings Page (/settings/integrations)
 *
 * Manages GitHub + Slack integration configuration.
 */

import { Suspense } from "react";
import { Metadata } from "next";
import { auth }     from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";

export const metadata: Metadata = {
  title:       "Integrations | Nexus Settings",
  description: "Connect Nexus with GitHub and Slack",
};

export default async function IntegrationsPage() {
  const { orgId } = await auth();
  if (!orgId) redirect("/sign-in");

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect external services to supercharge your workflow.
        </p>
      </div>
      <Suspense fallback={
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      }>
        <IntegrationsClient orgId={orgId} />
      </Suspense>
    </div>
  );
}
