"use client";

import { Priority } from "@prisma/client";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUp, Minus, ArrowDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPast, formatDistanceToNow, differenceInHours, isToday, isTomorrow, format } from "date-fns";

interface PriorityBadgeProps {
  priority: Priority;
  dueDate?: Date | null;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  isOverdue?: boolean;
  autoEscalated?: boolean; // NEW: Shows if priority was auto-escalated
  className?: string;
}

/**
 * Intelligent Priority Badge Component
 * 
 * **Principal-Level Enhancements:**
 * 1. **Auto-Escalation Indicator** - Shows when priority was automatically increased
 * 2. **Deadline Proximity Intelligence** - Pulse animation when deadline is near
 * 3. **Semantic Colors** - Visual hierarchy that guides attention
 * 4. **Motion Design** - Subtle animations for URGENT/overdue states
 * 5. **Accessibility** - ARIA labels and keyboard navigation support
 * 
 * **Design Philosophy:**
 * - URGENT cards pulse with red gradient (demands immediate attention)
 * - HIGH cards glow amber (important, needs attention soon)
 * - MEDIUM is neutral slate (standard priority)
 * - LOW is muted gray (can wait)
 * 
 * @example
 * ```tsx
 * <PriorityBadge
 *   priority="URGENT"
 *   dueDate={card.dueDate}
 *   isOverdue={isOverdue}
 *   autoEscalated={card.priorityEscalated}
 *   animated
 * />
 * ```
 */
export function PriorityBadge({
  priority,
  dueDate,
  showIcon = true,
  size = "md",
  animated = true,
  isOverdue = false,
  autoEscalated = false,
  className,
}: PriorityBadgeProps) {
  // Calculate if deadline is approaching (<24h)
  const isDeadlineNear =
    dueDate && !isOverdue
      ? (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60) < 24
      : false;

  // Size variants
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  // Priority configuration (semantic intelligence)
  const priorityConfig = {
    URGENT: {
      label: "Urgent",
      icon: AlertTriangle,
      baseClasses: "bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-lg",
      pulseColor: "bg-red-400",
      shouldPulse: true,
    },
    HIGH: {
      label: "High",
      icon: ArrowUp,
      baseClasses: "bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold shadow-md",
      pulseColor: "bg-orange-300",
      shouldPulse: isDeadlineNear, // Pulse when deadline is near
    },
    MEDIUM: {
      label: "Medium",
      icon: Minus,
      baseClasses: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
      pulseColor: "bg-slate-300",
      shouldPulse: false,
    },
    LOW: {
      label: "Low",
      icon: ArrowDown,
      baseClasses: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
      pulseColor: "bg-gray-200",
      shouldPulse: false,
    },
  };

  const config = priorityConfig[priority];
  const Icon = config.icon;

  // Overdue state overrides everything
  if (isOverdue) {
    return (
      <motion.div
        initial={animated ? { scale: 0.9, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-md",
          sizeClasses[size],
          "bg-gradient-to-r from-red-600 to-red-700 text-white font-bold shadow-xl",
          className
        )}
        role="status"
        aria-label={`Priority: ${config.label}, Overdue`}
      >
        {/* Pulse ring for overdue */}
        {animated && (
          <motion.div
            className="absolute inset-0 rounded-md bg-red-500"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0.2, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Content */}
        <span className="relative z-10 flex items-center gap-1.5">
          {showIcon && <AlertTriangle className={iconSizes[size]} />}
          <span className="font-bold">OVERDUE</span>
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animated ? { scale: 0.9, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-md transition-all",
        sizeClasses[size],
        config.baseClasses,
        className
      )}
      role="status"
      aria-label={`Priority: ${config.label}${autoEscalated ? " (Auto-escalated)" : ""}`}
    >
      {/* Pulse animation for URGENT or deadline-approaching HIGH priority */}
      {animated && config.shouldPulse && (
        <motion.div
          className={cn("absolute inset-0 rounded-md", config.pulseColor)}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.2, 0.5],
          }}
          transition={{
            duration: priority === "URGENT" ? 1.5 : 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center gap-1.5">
        {showIcon && <Icon className={iconSizes[size]} />}
        <span>{config.label}</span>
        
        {/* Auto-escalation indicator */}
        {autoEscalated && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            title="Priority auto-escalated due to approaching deadline"
          >
            <TrendingUp className={cn(iconSizes[size], "text-yellow-300")} />
          </motion.div>
        )}
      </span>
    </motion.div>
  );
}

/**
 * Priority Selector Component (for Card Modal)
 * 
 * Manual selector with visual preview - admin must click to confirm.
 */
interface PrioritySelectorProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  dueDate?: Date | null;
  disabled?: boolean;
}

export function PrioritySelector({ value, onChange, dueDate, disabled }: PrioritySelectorProps) {
  const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Priority Level</label>
        <div className="grid grid-cols-2 gap-3">
          {priorities.map((priority) => {
            const isSelected = value === priority;

            return (
              <button
                key={priority}
                onClick={() => onChange(priority)}
                disabled={disabled}
                className={cn(
                  "relative p-3 rounded-lg border-2 transition-all text-left",
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-200"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <PriorityBadge priority={priority} size="sm" animated={false} />
                
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {dueDate && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 <strong>Tip:</strong> Consider setting priority based on your due date to help organize your work effectively.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Relative Time Text Helper (Principal-Level Intelligence)
 * 
 * Returns human-friendly text like:
 * - "Due in 3 hours"
 * - "Due tomorrow"
 * - "Overdue by 2 days"
 */
function getRelativeTimeText(dueDate: Date): string {
  const now = new Date();
  const hoursRemaining = differenceInHours(dueDate, now);

  if (isPast(dueDate)) {
    return `Overdue by ${formatDistanceToNow(dueDate)}`;
  }

  if (hoursRemaining < 1) {
    return "Due in less than 1 hour";
  }

  if (hoursRemaining < 24) {
    return `Due in ${hoursRemaining} ${hoursRemaining === 1 ? "hour" : "hours"}`;
  }

  if (isToday(dueDate)) {
    return `Due today at ${format(dueDate, "h:mm a")}`;
  }

  if (isTomorrow(dueDate)) {
    return `Due tomorrow at ${format(dueDate, "h:mm a")}`;
  }

  return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`;
}
