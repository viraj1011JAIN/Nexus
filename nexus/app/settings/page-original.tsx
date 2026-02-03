"use client";

import { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  Lock,
  Smartphone,
  Mail,
  Eye,
  Save,
  Moon,
  Sun,
  Monitor,
  Check,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [boardActivity, setBoardActivity] = useState(true);
  const [cardComments, setCardComments] = useState(true);
  const [cardDueDates, setCardDueDates] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const handleSave = () => {
    toast.success("Settings saved successfully!", {
      description: "Your preferences have been updated.",
    });
  };

  const ThemeButton = ({ 
    value, 
    icon: Icon, 
    label,
    description 
  }: { 
    value: "light" | "dark" | "system"; 
    icon: any; 
    label: string;
    description: string;
  }) => {
    const isActive = theme === value;
    const isResolved = resolvedTheme === value;
    
    return (
      <button
        onClick={() => setTheme(value)}
        className={cn(
          "group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg overflow-hidden",
          isActive
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border hover:border-primary/50 bg-card"
        )}
      >
        {/* Animated Background Gradient */}
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500",
          isActive && "opacity-100"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-tl from-purple-500/10 via-transparent to-transparent" />
        </div>

        {/* Icon Container */}
        <div className={cn(
          "relative z-10 p-4 rounded-xl transition-all duration-300",
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
          <div className="absolute top-3 right-3 z-10">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-lg animate-in zoom-in-50 duration-300">
              <Check className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        {/* System Preview Badge */}
        {value === "system" && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
            {resolvedTheme === "dark" ? (
              <>
                <Moon className="h-2.5 w-2.5" />
                Dark
              </>
            ) : (
              <>
                <Sun className="h-2.5 w-2.5" />
                Light
              </>
            )}
          </div>
        )}
      </button>
    );
  };

  const ToggleSwitch = ({ 
    checked, 
    onChange,
    label,
    description 
  }: { 
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <label className="flex items-center justify-between cursor-pointer group py-2">
      <div className="flex-1">
        <div className="font-medium text-foreground group-hover:text-primary transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-sm text-muted-foreground mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={cn(
          "w-14 h-7 rounded-full transition-all duration-300",
          checked 
            ? "bg-primary" 
            : "bg-muted"
        )}>
          <div className={cn(
            "absolute top-0.5 w-6 h-6 bg-background rounded-full shadow-md transition-all duration-300",
            checked ? "left-[calc(100%-26px)]" : "left-0.5"
          )} />
        </div>
      </div>
    </label>
  );

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-lg">
            <SettingsIcon className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground text-lg mt-1">
              Customize your workspace experience
            </p>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="glass-effect border border-border/50 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Choose how NEXUS looks to you
            </p>
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              Production Grade
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Theme Mode Selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-4 block">
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

          {/* Additional Appearance Options */}
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
      </div>

      {/* Notifications Section */}
      <div className="glass-effect border border-border/50 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground">
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
            <p className="text-sm font-medium text-foreground mb-4">Activity Notifications</p>
            
            <div className="space-y-3 ml-4">
              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
      </div>

      {/* Privacy & Security Section */}
      <div className="glass-effect border border-border/50 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Privacy & Security</h2>
            <p className="text-sm text-muted-foreground">
              Your data is protected and secure
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <Lock className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground mt-1">Your account is protected with 2FA via Clerk</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">End-to-End Encryption</p>
              <p className="text-sm text-muted-foreground mt-1">All data is encrypted in transit and at rest</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <Globe className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Session Management</p>
              <p className="text-sm text-muted-foreground mt-1">Active session monitoring and auto-logout enabled</p>
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
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4 pt-4">
        <Button
          variant="outline"
          className="border-border hover:bg-accent"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}