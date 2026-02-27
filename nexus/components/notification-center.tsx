"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, User, AlertCircle, Clock, GitBranch, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/actions/notification-actions";
import { NotificationType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationItem {
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

// ─── Icon map ─────────────────────────────────────────────────────────────────

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  MENTIONED: User,
  ASSIGNED: User,
  CARD_DUE_SOON: Clock,
  CARD_OVERDUE: AlertCircle,
  COMMENT_ON_ASSIGNED_CARD: User,
  BOARD_SHARED: Share2,
  SPRINT_STARTED: GitBranch,
  DEPENDENCY_RESOLVED: Check,
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  MENTIONED: "text-blue-500",
  ASSIGNED: "text-green-500",
  CARD_DUE_SOON: "text-yellow-500",
  CARD_OVERDUE: "text-red-500",
  COMMENT_ON_ASSIGNED_CARD: "text-purple-500",
  BOARD_SHARED: "text-teal-500",
  SPRINT_STARTED: "text-orange-500",
  DEPENDENCY_RESOLVED: "text-emerald-500",
};

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;
  const iconColor = NOTIFICATION_COLORS[notification.type] ?? "text-gray-500";

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
        !notification.isRead && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
    >
      {/* Unread dot */}
      <div className="mt-1 flex-shrink-0">
        {!notification.isRead ? (
          <span className="block h-2 w-2 rounded-full bg-blue-500" />
        ) : (
          <span className="block h-2 w-2 rounded-full bg-transparent" />
        )}
      </div>

      {/* Icon */}
      <div className={cn("mt-0.5 flex-shrink-0", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm line-clamp-2", !notification.isRead && "font-medium")}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notification.body}</p>
        )}
        {notification.entityTitle && (
          <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">
            &ldquo;{notification.entityTitle}&rdquo;
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>

      {/* Actions (shown on hover) */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            title="Mark as read"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true); // true so first open shows a spinner
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 30 seconds for new notifications.
  // Fetch the count directly inside the effect (and the interval callback) so no
  // useCallback reference is called from the effect body — all setState calls are
  // inside .then() callbacks (async, not synchronous in the effect).
  useEffect(() => {
    const fetchCount = () => {
      getUnreadNotificationCount().then((result) => {
        if (typeof result.data === "number") setUnreadCount(result.data);
      });
    };
    fetchCount();
    pollRef.current = setInterval(fetchCount, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Full load when panel opens — server action called inside the effect,
  // setState only inside the .then() callback (async, never synchronous in the effect body).
  useEffect(() => {
    if (!open) return;
    getNotifications().then((result) => {
      setLoading(false);
      if (result.data) {
        setNotifications(result.data as NotificationItem[]);
        setUnreadCount(result.data.filter((n) => !n.isRead).length);
      }
    });
  }, [open]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
    toast.success("All notifications marked as read");
  };

  const handleDelete = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id)?.isRead === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    await deleteNotification(id);
  };

  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0 shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Body */}
        <ScrollArea className="h-[420px]">
          {loading && notifications.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading…
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}

          {/* Unread section */}
          {unread.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                New
              </div>
              {unread.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}

          {/* Read section */}
          {read.length > 0 && (
            <>
              {unread.length > 0 && <Separator className="my-1" />}
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
                Earlier
              </div>
              {read.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <p className="text-xs text-center text-muted-foreground">
            Showing last 50 notifications
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
