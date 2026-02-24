"use client";

import { useState, type ElementType } from "react";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  Lock,
  Save,
  Moon,
  Sun,
  Monitor,
  Check,
  Loader2,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  savePreferences,
} from "@/actions/user-preferences";
import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/settings-defaults";

interface SettingsClientProps {
  initialPreferences: UserPreferences;
}

// ─── Sub-components declared OUTSIDE parent to avoid re-creation on each render ─

function ThemeButton({
  value,
  icon: Icon,
  label,
  description,
}: {
  value: "light" | "dark" | "system";
  icon: ElementType;
  label: string;
  description: string;
}) {
  const { theme, setTheme } = useTheme();
  const isActive = theme === value;

  return (
    <button
      onClick={() => setTheme(value)}
      className={cn(
        "group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] overflow-hidden",
        isActive
          ? "border-primary bg-accent shadow-[0_4px_12px_rgba(124,58,237,0.15)]"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
      )}
    >
      {/* Animated Background Gradient */}
      <div className={cn(
        "absolute inset-0 opacity-0 transition-opacity duration-500",
        isActive && "opacity-100"
      )}>
        <div className="absolute inset-0 bg-linear-to-br from-[#7C3AED]/10 via-[#A855F7]/5 to-transparent" />
      </div>

      {/* Icon Container */}
      <div className={cn(
        "relative z-10 w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300",
        isActive 
          ? "bg-primary/10 ring-2 ring-primary/20" 
          : "bg-muted group-hover:bg-primary/5"
      )}>
        <Icon 
          className={cn(
            "h-8 w-8 transition-all duration-300",
            isActive 
              ? "text-primary scale-110" 
              : "text-muted-foreground group-hover:text-primary group-hover:scale-105"
          )} 
        />
      </div>

      {/* Label */}
      <div className="relative z-10 text-center space-y-1">
        <div className={cn(
          "text-base font-semibold transition-colors duration-300",
          isActive 
            ? "text-primary" 
            : "text-foreground group-hover:text-primary"
        )}>
          {label}
        </div>
        <div className="text-xs text-muted-foreground px-2">
          {description}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 z-10 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white shadow-lg"
        >
          <Check className="h-3.5 w-3.5" />
        </motion.div>
      )}
    </button>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group py-2">
      <div className="flex-1">
        <div className="font-medium text-[15px] text-foreground group-hover:text-primary transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-[14px] text-muted-foreground mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="relative ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={cn(
          "w-11 h-6 rounded-full transition-all duration-200 relative",
          checked 
            ? "bg-linear-to-r from-[#7C3AED] to-[#A855F7]" 
            : "bg-muted"
        )}>
          <motion.div
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ left: checked ? "calc(100% - 22px)" : "2px" }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </div>
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsClient({ initialPreferences }: SettingsClientProps) {
  const [emailNotifications, setEmailNotifications] = useState(initialPreferences.emailNotifications);
  const [desktopNotifications, setDesktopNotifications] = useState(initialPreferences.desktopNotifications);
  const [boardActivity, setBoardActivity] = useState(initialPreferences.boardActivity);
  const [cardComments, setCardComments] = useState(initialPreferences.cardComments);
  const [cardDueDates, setCardDueDates] = useState(initialPreferences.cardDueDates);
  const [weeklyDigest, setWeeklyDigest] = useState(initialPreferences.weeklyDigest);
  const [autoSave, setAutoSave] = useState(initialPreferences.autoSave);
  const [compactMode, setCompactMode] = useState(initialPreferences.compactMode);
  const [showArchived, setShowArchived] = useState(initialPreferences.showArchived);
  const [isSaving, setIsSaving] = useState(false);

  const currentPrefs = (): UserPreferences => ({
    emailNotifications,
    desktopNotifications,
    boardActivity,
    cardComments,
    cardDueDates,
    weeklyDigest,
    autoSave,
    compactMode,
    showArchived,
  });

  const handleSave = async () => {
    setIsSaving(true);
    const result = await savePreferences(currentPrefs());
    setIsSaving(false);
    if (result.success) {
      toast.success("Settings saved successfully!", {
        description: "Your preferences have been updated.",
      });
    } else {
      toast.error("Failed to save settings", {
        description: result.error ?? "Please try again.",
      });
    }
  };

  const handleReset = async () => {
    setEmailNotifications(DEFAULT_PREFERENCES.emailNotifications);
    setDesktopNotifications(DEFAULT_PREFERENCES.desktopNotifications);
    setBoardActivity(DEFAULT_PREFERENCES.boardActivity);
    setCardComments(DEFAULT_PREFERENCES.cardComments);
    setCardDueDates(DEFAULT_PREFERENCES.cardDueDates);
    setWeeklyDigest(DEFAULT_PREFERENCES.weeklyDigest);
    setAutoSave(DEFAULT_PREFERENCES.autoSave);
    setCompactMode(DEFAULT_PREFERENCES.compactMode);
    setShowArchived(DEFAULT_PREFERENCES.showArchived);
    setIsSaving(true);
    const result = await savePreferences(DEFAULT_PREFERENCES);
    setIsSaving(false);
    if (result.success) {
      toast.success("Settings reset to defaults");
    } else {
      toast.error("Failed to reset settings");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 sm:space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <motion.div
              className="absolute -inset-1 bg-linear-to-br from-[#7C3AED] to-[#A855F7] rounded-xl opacity-20 blur-lg"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight text-foreground">Settings</h1>
            <p className="text-[13px] sm:text-[15px] text-muted-foreground mt-1">
              Manage your account preferences and workspace settings
            </p>
          </div>
        </div>
      </motion.div>

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-pink-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
            <p className="text-[14px] text-muted-foreground">
              Choose how NEXUS looks to you
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Theme Mode Selector */}
          <div>
            <label className="text-[14px] font-medium text-foreground mb-4 block">
              Theme Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ThemeButton 
                value="light" 
                icon={Sun} 
                label="Light" 
                description="Bright and clean"
              />
              <ThemeButton 
                value="dark" 
                icon={Moon} 
                label="Dark" 
                description="Easy on the eyes"
              />
              <ThemeButton 
                value="system" 
                icon={Monitor} 
                label="System" 
                description="Matches your OS"
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className="pt-6 border-t border-border space-y-4">
            <ToggleSwitch
              checked={compactMode}
              onChange={setCompactMode}
              label="Compact Mode"
              description="Reduce spacing for a denser layout"
            />
            
            <ToggleSwitch
              checked={autoSave}
              onChange={setAutoSave}
              label="Auto-save Changes"
              description="Automatically save edits without manual confirmation"
            />
          </div>
        </div>
      </motion.div>

      {/* Notifications Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
            <p className="text-[14px] text-muted-foreground">
              Manage how you receive updates
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <ToggleSwitch
            checked={emailNotifications}
            onChange={setEmailNotifications}
            label="Email Notifications"
            description="Receive email updates about your boards and cards"
          />

          <ToggleSwitch
            checked={desktopNotifications}
            onChange={setDesktopNotifications}
            label="Desktop Notifications"
            description="Get real-time push notifications on your desktop"
          />

          <div className="pt-4 border-t border-border">
            <p className="text-[14px] font-medium text-foreground mb-4">Activity Notifications</p>
            
            <div className="space-y-3 ml-4">
              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-muted-foreground group-hover:text-foreground transition-colors">
                  Board activity updates
                </span>
                <input
                  type="checkbox"
                  checked={boardActivity}
                  onChange={(e) => setBoardActivity(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer border-border"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-muted-foreground group-hover:text-foreground transition-colors">
                  Card comments and mentions
                </span>
                <input
                  type="checkbox"
                  checked={cardComments}
                  onChange={(e) => setCardComments(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer border-border"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-muted-foreground group-hover:text-foreground transition-colors">
                  Card due date reminders
                </span>
                <input
                  type="checkbox"
                  checked={cardDueDates}
                  onChange={(e) => setCardDueDates(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer border-border"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-muted-foreground group-hover:text-foreground transition-colors">
                  Weekly activity digest
                </span>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="w-5 h-5 text-primary rounded focus:ring-2 focus:ring-primary cursor-pointer border-border"
                />
              </label>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Privacy & Security Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">Privacy & Security</h2>
            <p className="text-[14px] text-muted-foreground">
              Your data is protected and secure
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-success/10 dark:bg-success/20 rounded-xl border-2 border-success/20">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-foreground">Two-Factor Authentication</p>
              <p className="text-[14px] text-muted-foreground mt-1">Your account is protected with 2FA via Clerk</p>
            </div>
            <div className="shrink-0">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-success/10 dark:bg-success/20 rounded-xl border-2 border-success/20">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-foreground">End-to-End Encryption</p>
              <p className="text-[14px] text-muted-foreground mt-1">All data is encrypted in transit and at rest</p>
            </div>
            <div className="shrink-0">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-success/10 dark:bg-success/20 rounded-xl border-2 border-success/20">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-foreground">Session Management</p>
              <p className="text-[14px] text-muted-foreground mt-1">Active session monitoring and auto-logout enabled</p>
            </div>
            <div className="shrink-0">
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <ToggleSwitch
              checked={showArchived}
              onChange={setShowArchived}
              label="Show Archived Boards"
              description="Display archived boards in the sidebar"
            />
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex justify-end gap-4 pt-4"
      >
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
          className="border-border text-muted-foreground hover:bg-muted font-medium px-6"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-linear-to-r from-[#7C3AED] to-[#A855F7] hover:brightness-110 text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.35)] font-medium px-6"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </motion.div>
    </div>
  );
}
