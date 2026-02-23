import { ApiKeysSettings } from "@/components/settings/api-keys-settings";

export const metadata = { title: "API Keys — Nexus" };

export default function ApiKeysPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <ApiKeysSettings />
    </div>
  );
}
