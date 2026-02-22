"use server";

import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/settings-defaults";

/**
 * Load the current user's saved preferences.
 * Returns defaults if no record exists yet (first visit).
 */
export async function getPreferences(): Promise<UserPreferences> {
  const { userId } = await getTenantContext();

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      preferences: true,
    },
  });

  if (!user?.preferences) {
    return DEFAULT_PREFERENCES;
  }

  const p = user.preferences;
  return {
    emailNotifications: p.emailNotifications,
    desktopNotifications: p.desktopNotifications,
    boardActivity: p.boardActivity,
    cardComments: p.cardComments,
    cardDueDates: p.cardDueDates,
    weeklyDigest: p.weeklyDigest,
    autoSave: p.autoSave,
    compactMode: p.compactMode,
    showArchived: p.showArchived,
  };
}

/**
 * Persist the user's preferences (upsert — safe to call on first save).
 */
export async function savePreferences(
  prefs: UserPreferences
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await getTenantContext();

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    await db.userPreference.upsert({
      where: { userId: user.id },
      update: prefs,
      create: { userId: user.id, ...prefs },
    });

    return { success: true };
  } catch {
    return { success: false, error: "Failed to save preferences" };
  }
}
