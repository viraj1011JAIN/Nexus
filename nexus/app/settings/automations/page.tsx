import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AutomationBuilder } from "@/components/settings/automation-builder";

export const metadata = {
  title: "Automations | Nexus Settings",
  description: "Automate repetitive board tasks with trigger-action rules",
};

async function AutomationsPageContent() {
  const { orgId } = await auth();
  if (!orgId) redirect("/sign-in");

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <AutomationBuilder />
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 max-w-3xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      }
    >
      <AutomationsPageContent />
    </Suspense>
  );
}
