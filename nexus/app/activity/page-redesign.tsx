"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { 
  Activity as ActivityIcon, 
  Clock, 
  User
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
    bg: "bg-success/10 dark:bg-success/20",
    text: "text-success",
    border: "border-success",
    label: "CREATE",
  },
  UPDATE: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500",
    label: "UPDATE",
  },
  DELETE: {
    bg: "bg-destructive/10 dark:bg-destructive/20",
    text: "text-destructive",
    border: "border-destructive",
    label: "DELETE",
  },
  MOVE: {
    bg: "bg-accent",
    text: "text-primary",
    border: "border-primary",
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
          className="text-muted-foreground text-base"
        >
          Loading activity...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-600 to-purple-500 flex items-center justify-center">
              <ActivityIcon className="h-6 w-6 text-white" />
            </div>
            <motion.div
              className="absolute -inset-1 bg-linear-to-br from-violet-600 to-purple-500 rounded-xl opacity-20 blur-lg"
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <h1 className="text-[32px] font-semibold text-foreground">
            Activity Log
          </h1>
        </div>
        <p className="text-[15px] text-muted-foreground ml-[60px]">
          Track all changes and actions across your boards
        </p>
      </motion.div>

      {/* Filter Chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-3 mb-8"
      >
        {(["ALL", "CARD", "LIST"] as FilterType[]).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={cn(
              "h-8 px-3 rounded-lg text-[13px] font-medium transition-all duration-200 border",
              filter === filterType
                ? "bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:bg-accent"
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
          className="flex flex-col items-center justify-center py-16 px-8 bg-card rounded-2xl border border-border"
        >
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <ActivityIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-[15px] text-muted-foreground font-medium mb-1">
            No activity yet
          </p>
          <p className="text-[13px] text-muted-foreground">
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
                  <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateGroup}
                  </h3>
                  <div className="flex-1 h-px bg-muted" />
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
                          className="bg-card rounded-xl border border-border p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5"
                        >
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="shrink-0 relative">
                              {log.userImage ? (
                                <img
                                  src={log.userImage}
                                  alt={log.userName}
                                  className={cn(
                                    "w-12 h-12 rounded-full border-2",
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
                                <span className="font-semibold text-[15px] text-foreground">
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
                                <span className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-muted-foreground uppercase">
                                  {log.entityType}
                                </span>
                                <span className="text-[15px] text-primary font-medium truncate">
                                  &quot;{log.entityTitle}&quot;
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
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
