import { getPreferences } from "@/actions/user-preferences";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const preferences = await getPreferences();
  return <SettingsClient initialPreferences={preferences} />;
}