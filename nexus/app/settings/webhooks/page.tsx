import { WebhooksSettings } from "@/components/settings/webhooks-settings";

export const metadata = { title: "Webhooks — Nexus" };

export default function WebhooksPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <WebhooksSettings />
    </div>
  );
}
