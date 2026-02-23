"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { 
  Activity as ActivityIcon, 
  Clock, 
  User, 
  Trash2,
  MoveHorizontal,
  Edit,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuditLog = {
  id: string;
  action: string;
  entityTitle: string;
  entityType: string;
  userName: string;
  userImage: string;
  createdAt: string;
};

type FilterType = "ALL" | "CARD" | "LIST" | "MY_ACTIONS";

const actionConfig = {
  CREATE: {
    bg: "bg-[#ECFDF5] dark:bg-[#064E3B]",
    text: "text-[#10B981] dark:text-[#34D399]",
    border: "border-[#10B981]",
    borderLeft: "border-l-4 border-l-[#10B981]",
    icon: Plus,
    label: "CREATE",
  },
  UPDATE: {
    bg: "bg-[#EFF6FF] dark:bg-[#1E3A8A]",
    text: "text-[#3B82F6] dark:text-[#60A5FA]",
    border: "border-[#3B82F6]",
    borderLeft: "border-l-4 border-l-[#3B82F6]",
    icon: Edit,
    label: "UPDATE",
  },
  DELETE: {
    bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]",
    text: "text-[#EF4444] dark:text-[#F87171]",
    border: "border-[#EF4444]",
    borderLeft: "border-l-4 border-l-[#EF4444]",
    icon: Trash2,
    label: "DELETE",
  },
  MOVE: {
    bg: "bg-[#F5F3FF] dark:bg-[#2E1A2E]",
    text: "text-[#7C3AED] dark:text-[#A78BFA]",
    border: "border-[#7C3AED]",
    borderLeft: "border-l-4 border-l-[#7C3AED]",
    icon: MoveHorizontal,
    label: "MOVE",
  },
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const groupByDate = (logs: AuditLog[]) => {
    const groups: { [key: string]: AuditLog[] } = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    logs.forEach((log) => {
      const logDate = new Date(log.createdAt);
      const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

      if (logDay.getTime() === today.getTime()) {
        groups.Today.push(log);
      } else if (logDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(log);
      } else if (logDate >= weekAgo) {
        groups["This Week"].push(log);
      } else {
        groups.Earlier.push(log);
      }
    });

    return groups;
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    if (filter === "CARD") return log.entityType === "CARD";
    if (filter === "LIST") return log.entityType === "LIST";
    return false;
  });

  const groupedLogs = groupByDate(filteredLogs);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-[#64748B] dark:text-[#94A3B8] text-base"
        >
          Loading activity...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8 sm:mb-12 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
              <ActivityIcon className="h-6 w-6 text-white" />
            </div>
            <motion.div
              className="absolute -inset-1 bg-gradient-to-br from-[#7C3AED] to-[#A855F7] rounded-xl opacity-20 blur-lg"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight text-[#0F172A] dark:text-[#F1F5F9]">
              Activity Log
            </h1>
            <p className="text-[13px] sm:text-[15px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              Track all changes and actions across your boards
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filter Chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8"
      >
        {(["ALL", "CARD", "LIST"] as FilterType[]).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={cn(
              "px-3 sm:px-4 py-2 rounded-lg text-[13px] sm:text-[14px] font-medium transition-all duration-200 border-2 whitespace-nowrap",
              filter === filterType
                ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                : "bg-white dark:bg-[#1A1F2E] text-[#475569] dark:text-[#CBD5E1] border-[#E5E7EB] dark:border-[#252B3A] hover:border-[#7C3AED]/50 hover:bg-[#F5F3FF] dark:hover:bg-[#2E1A2E]"
            )}
          >
            {filterType === "ALL"
              ? "All Activities"
              : filterType === "CARD"
              ? "Cards Only"
              : "Lists Only"}
          </button>
        ))}
      </motion.div>

      {/* Activity Feed */}
      {filteredLogs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex flex-col items-center justify-center py-16 px-8 bg-white dark:bg-[#1A1F2E] rounded-2xl border border-[#E5E7EB] dark:border-[#252B3A]"
        >
          <div className="w-20 h-20 rounded-full bg-[#F3F4F6] dark:bg-[#252B3A] flex items-center justify-center mb-4">
            <ActivityIcon className="h-10 w-10 text-[#94A3B8] dark:text-[#64748B]" />
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] font-medium mb-1">
            No activity yet
          </p>
          <p className="text-[13px] text-[#94A3B8] dark:text-[#64748B]">
            Start creating boards and cards to see activity here
          </p>
        </motion.div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedLogs).map(([dateGroup, groupLogs], groupIndex) => {
            if (groupLogs.length === 0) return null;

            return (
              <motion.div
                key={dateGroup}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + groupIndex * 0.05 }}
              >
                {/* Section Header */}
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[13px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                    {dateGroup}
                  </h3>
                  <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#252B3A]" />
                </div>

                {/* Activity Cards */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {groupLogs.map((log, index) => {
                      const config =
                        actionConfig[log.action as keyof typeof actionConfig] ||
                        actionConfig.UPDATE;

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className={cn(
                            "bg-white dark:bg-[#1A1F2E] rounded-xl border border-[#E5E7EB] dark:border-[#252B3A] p-3 sm:p-4 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900/30 transition-all duration-200 hover:-translate-y-0.5",
                            config.borderLeft
                          )}
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            {/* Avatar */}
                            <div className="flex-shrink-0 relative">
                              {log.userImage ? (
                                <img
                                  src={log.userImage}
                                  alt={log.userName}
                                  className={cn(
                                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2",
                                    config.border
                                  )}
                                />
                              ) : (
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-full border-2 flex items-center justify-center",
                                    config.border,
                                    config.bg
                                  )}
                                >
                                  <User className={cn("h-6 w-6", config.text)} />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <span className="font-semibold text-[15px] text-[#0F172A] dark:text-[#F1F5F9]">
                                  {log.userName}
                                </span>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide",
                                    config.bg,
                                    config.text
                                  )}
                                >
                                  {config.label}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#252B3A] text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] uppercase">
                                  {log.entityType}
                                </span>
                                <span className="text-[15px] text-[#7C3AED] dark:text-[#A78BFA] font-medium truncate">
                                  &quot;{log.entityTitle}&quot;
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-[13px] text-[#94A3B8] dark:text-[#64748B]">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(log.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
