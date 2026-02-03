"use client";

import { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
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
    
    return (
      <button
        onClick={() => setTheme(value)}
        className={cn(
          "group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] overflow-hidden",
          isActive
            ? "border-[#7C3AED] bg-[#F5F3FF] dark:bg-[#2E1A2E] shadow-[0_4px_12px_rgba(124,58,237,0.15)]"
            : "border-[#E5E7EB] dark:border-[#252B3A] bg-white dark:bg-[#1A1F2E] hover:border-[#7C3AED]/50 hover:bg-[#F5F3FF]/50 dark:hover:bg-[#2E1A2E]/50"
        )}
      >
        {/* Animated Background Gradient */}
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500",
          isActive && "opacity-100"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/10 via-[#A855F7]/5 to-transparent" />
        </div>

        {/* Icon Container */}
        <div className={cn(
          "relative z-10 w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300",
          isActive 
            ? "bg-[#7C3AED]/10 ring-2 ring-[#7C3AED]/20" 
            : "bg-[#F3F4F6] dark:bg-[#252B3A] group-hover:bg-[#7C3AED]/5"
        )}>
          <Icon 
            className={cn(
              "h-8 w-8 transition-all duration-300",
              isActive 
                ? "text-[#7C3AED] scale-110" 
                : "text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#7C3AED] group-hover:scale-105"
            )} 
          />
        </div>

        {/* Label */}
        <div className="relative z-10 text-center space-y-1">
          <div className={cn(
            "text-base font-semibold transition-colors duration-300",
            isActive 
              ? "text-[#7C3AED]" 
              : "text-[#0F172A] dark:text-[#F1F5F9] group-hover:text-[#7C3AED]"
          )}>
            {label}
          </div>
          <div className="text-xs text-[#64748B] dark:text-[#94A3B8] px-2">
            {description}
          </div>
        </div>

        {/* Active Indicator */}
        {isActive && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 right-3 z-10 flex items-center justify-center h-6 w-6 rounded-full bg-[#7C3AED] text-white shadow-lg"
          >
            <Check className="h-3.5 w-3.5" />
          </motion.div>
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
        <div className="font-medium text-[15px] text-[#0F172A] dark:text-[#F1F5F9] group-hover:text-[#7C3AED] transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
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
            ? "bg-gradient-to-r from-[#7C3AED] to-[#A855F7]" 
            : "bg-[#E5E7EB] dark:bg-[#252B3A]"
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

  return (
    <div className="max-w-5xl mx-auto px-8 py-12 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <motion.div
              className="absolute -inset-1 bg-gradient-to-br from-[#7C3AED] to-[#A855F7] rounded-xl opacity-20 blur-lg"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div>
            <h1 className="text-[32px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Settings</h1>
            <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              Customize your workspace experience
            </p>
          </div>
        </div>
      </motion.div>

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white dark:bg-[#1A1F2E] border border-[#E5E7EB] dark:border-[#252B3A] rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EC4899]/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-[#EC4899]" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Appearance</h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
              Choose how NEXUS looks to you
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Theme Mode Selector */}
          <div>
            <label className="text-[14px] font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-4 block">
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
          <div className="pt-6 border-t border-[#E5E7EB] dark:border-[#252B3A] space-y-4">
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
        className="bg-white dark:bg-[#1A1F2E] border border-[#E5E7EB] dark:border-[#252B3A] rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Notifications</h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
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

          <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#252B3A]">
            <p className="text-[14px] font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-4">Activity Notifications</p>
            
            <div className="space-y-3 ml-4">
              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9] transition-colors">
                  Board activity updates
                </span>
                <input
                  type="checkbox"
                  checked={boardActivity}
                  onChange={(e) => setBoardActivity(e.target.checked)}
                  className="w-5 h-5 text-[#7C3AED] rounded focus:ring-2 focus:ring-[#7C3AED] cursor-pointer border-[#E5E7EB] dark:border-[#252B3A]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9] transition-colors">
                  Card comments and mentions
                </span>
                <input
                  type="checkbox"
                  checked={cardComments}
                  onChange={(e) => setCardComments(e.target.checked)}
                  className="w-5 h-5 text-[#7C3AED] rounded focus:ring-2 focus:ring-[#7C3AED] cursor-pointer border-[#E5E7EB] dark:border-[#252B3A]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9] transition-colors">
                  Card due date reminders
                </span>
                <input
                  type="checkbox"
                  checked={cardDueDates}
                  onChange={(e) => setCardDueDates(e.target.checked)}
                  className="w-5 h-5 text-[#7C3AED] rounded focus:ring-2 focus:ring-[#7C3AED] cursor-pointer border-[#E5E7EB] dark:border-[#252B3A]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group py-1">
                <span className="text-[14px] text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#F1F5F9] transition-colors">
                  Weekly activity digest
                </span>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="w-5 h-5 text-[#7C3AED] rounded focus:ring-2 focus:ring-[#7C3AED] cursor-pointer border-[#E5E7EB] dark:border-[#252B3A]"
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
        className="bg-white dark:bg-[#1A1F2E] border border-[#E5E7EB] dark:border-[#252B3A] rounded-2xl p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-[#10B981]" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Privacy & Security</h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
              Your data is protected and secure
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-[#ECFDF5] dark:bg-[#064E3B] rounded-xl border-2 border-[#10B981]/20">
            <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-[#0F172A] dark:text-[#F1F5F9]">Two-Factor Authentication</p>
              <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1">Your account is protected with 2FA via Clerk</p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#ECFDF5] dark:bg-[#064E3B] rounded-xl border-2 border-[#10B981]/20">
            <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-[#0F172A] dark:text-[#F1F5F9]">End-to-End Encryption</p>
              <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1">All data is encrypted in transit and at rest</p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#ECFDF5] dark:bg-[#064E3B] rounded-xl border-2 border-[#10B981]/20">
            <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[15px] text-[#0F172A] dark:text-[#F1F5F9]">Session Management</p>
              <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1">Active session monitoring and auto-logout enabled</p>
            </div>
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#252B3A]">
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
          className="border-[#E5E7EB] dark:border-[#252B3A] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F9FAFB] dark:hover:bg-[#252B3A] font-medium px-6"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:brightness-110 text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.35)] font-medium px-6"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}
