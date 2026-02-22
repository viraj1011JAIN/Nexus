/**
 * User preference types and default values.
 * Kept in a plain module (not "use server") so it can be imported
 * by both server actions and client components without Next.js restrictions.
 */

export interface UserPreferences {
  emailNotifications: boolean;
  desktopNotifications: boolean;
  boardActivity: boolean;
  cardComments: boolean;
  cardDueDates: boolean;
  weeklyDigest: boolean;
  autoSave: boolean;
  compactMode: boolean;
  showArchived: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  desktopNotifications: false,
  boardActivity: true,
  cardComments: true,
  cardDueDates: true,
  weeklyDigest: false,
  autoSave: true,
  compactMode: false,
  showArchived: false,
};
