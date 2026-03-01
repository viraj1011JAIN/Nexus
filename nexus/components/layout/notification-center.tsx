"use client";

/**
 * NotificationCenter
 *
 * Bell icon in the top navigation that shows real-time notifications.
 *
 * Features
 * ────────
 * • Unread-count badge that increments live via Supabase Realtime
 * • Popover list of the 20 most recent notifications
 * • Per-notification mark-as-read on click (navigates to the linked entity)
 * • "Mark all as read" button
 * • Icon per notification type (mention, assign, due-date, etc.)
 * • Relative timestamps ("2 minutes ago")
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useOrganization } from "@clerk/nextjs";
import {
  Bell,
  AtSign,
  UserCheck,
  Clock,
  AlertTriangle,
  MessageCircle,
  Share2,
  Zap,
  Link2,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notification-actions";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationType =
  | "MENTIONED"
  | "ASSIGNED"
  | "CARD_DUE_SOON"
  | "CARD_OVERDUE"
  | "COMMENT_ON_ASSIGNED_CARD"
  | "BOARD_SHARED"
  | "SPRINT_STARTED"
  | "DEPENDENCY_RESOLVED";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityTitle?: string | null;
  actorName: string;
  actorImage?: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<
  NotificationType,
  React.ComponentType<{ className?: string }>
> = {
  MENTIONED: AtSign,
  ASSIGNED: UserCheck,
  CARD_DUE_SOON: Clock,
  CARD_OVERDUE: AlertTriangle,
  COMMENT_ON_ASSIGNED_CARD: MessageCircle,
  BOARD_SHARED: Share2,
  SPRINT_STARTED: Zap,
  DEPENDENCY_RESOLVED: Link2,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  MENTIONED: "text-blue-500",
  ASSIGNED: "text-green-500",
  CARD_DUE_SOON: "text-yellow-500",
  CARD_OVERDUE: "text-red-500",
  COMMENT_ON_ASSIGNED_CARD: "text-purple-500",
  BOARD_SHARED: "text-cyan-500",
  SPRINT_STARTED: "text-orange-500",
  DEPENDENCY_RESOLVED: "text-emerald-500",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const { organization } = useOrganization();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Load notification list when popover opens ────────────────────────────

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getNotifications();
      if ("data" in result && result.data) {
        setNotifications(result.data as Notification[]);
        // Sync unread count with what we just fetched (prevents double-fetch)
        const unread = (result.data as Notification[]).filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    const result = await getUnreadNotificationCount();
    if ("data" in result && typeof result.data === "number") {
      setUnreadCount(result.data);
    }
  }, []);

  // ── Initial unread count on mount ────────────────────────────────────────

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // ── Load full list when popover opens ────────────────────────────────────

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  // ── Supabase Realtime — increment badge on new notifications ────────────

  useEffect(() => {
    if (!userId || !organization?.id) return;

    let isMounted = true;

    async function subscribe() {
      const token = await getToken({ template: "supabase" }).catch(() => null);
      const supabase = getAuthenticatedSupabaseClient(token);

      // Channel scoped to this user in this org — prevents cross-tenant leakage
      const channelName = `org:${organization!.id}:notifications:${userId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!isMounted) return;

            // Optimistically increment badge without a server round-trip
            setUnreadCount((prev) => prev + 1);

            // If the popover is currently open, prepend the new notification
            setOpen((isOpen) => {
              if (isOpen) {
                setNotifications((prev) => [payload.new as Notification, ...prev]);
              }
              return isOpen;
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    subscribe();

    return () => {
      isMounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, organization?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Mark as read (fire-and-forget, UI updates optimistically)
      if (!notification.isRead) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        await markNotificationRead(notification.id);
      }

      setOpen(false);

      // Navigate to the linked entity when available
      if (notification.entityType === "CARD" && notification.entityId) {
        router.push(`/board?card=${notification.entityId}`);
      } else if (notification.entityType === "BOARD" && notification.entityId) {
        router.push(`/board/${notification.entityId}`);
      }
    },
    [router]
  );

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px] font-bold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] p-0"
        align="end"
        sideOffset={8}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* ── Notification list ─────────────────────────────────────────── */}
        <ScrollArea className="max-h-[480px]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ul role="list" className="divide-y">
              {notifications.map((notification) => {
                const Icon = TYPE_ICON[notification.type] ?? Bell;
                const iconColor = TYPE_COLOR[notification.type] ?? "text-muted-foreground";
                const date = new Date(notification.createdAt);
                const relativeTime = formatDistanceToNow(date, { addSuffix: true });

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={[
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                        "hover:bg-accent focus:bg-accent focus:outline-none",
                        notification.isRead ? "opacity-60" : "bg-accent/30",
                      ].join(" ")}
                      onClick={() => handleNotificationClick(notification)}
                      aria-label={notification.title}
                    >
                      {/* Type icon */}
                      <span
                        className={[
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center",
                          "rounded-full bg-background shadow-sm ring-1 ring-border",
                        ].join(" ")}
                        aria-hidden
                      >
                        <Icon className={`h-4 w-4 ${iconColor}`} />
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {relativeTime}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!notification.isRead && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
