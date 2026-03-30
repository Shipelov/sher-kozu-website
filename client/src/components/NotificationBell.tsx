import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, BellDot, Check, CheckCheck, Camera, Info, ExternalLink, Newspaper, CalendarHeart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function notificationIcon(type: string) {
  switch (type) {
    case "photo_approved":
      return <Camera className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "photo_rejected":
      return <Camera className="h-4 w-4 text-rose-500 shrink-0" />;
    case "club_post":
      return <Newspaper className="h-4 w-4 text-sky-500 shrink-0" />;
    case "club_event":
      return <CalendarHeart className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-primary shrink-0" />;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [isShaking, setIsShaking] = useState(false);
  const prevUnreadRef = useRef<number | null>(null);

  const unreadCountQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const listQuery = trpc.notifications.list.useQuery(undefined, {
    enabled: open,
  });

  const utils = trpc.useUtils();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("Все уведомления отмечены как прочитанные");
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const unreadCount = unreadCountQuery.data ?? 0;
  const notifications = listQuery.data ?? [];
  const hasUnread = unreadCount > 0;

  // Detect when unread count increases → trigger shake
  useEffect(() => {
    const prev = prevUnreadRef.current;
    // Only shake if count increased (not on initial load when prev is null)
    if (prev !== null && unreadCount > prev) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 1200);
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markReadMutation.mutate({ notificationId: notification.id });
    }
    if (notification.link) {
      setLocation(notification.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isShaking ? "animate-bell-shake" : ""
          }`}
          aria-label={hasUnread ? `${unreadCount} непрочитанных уведомлений` : "Уведомления"}
        >
          {hasUnread ? (
            <BellDot className="h-[18px] w-[18px] text-foreground" />
          ) : (
            <Bell className="h-[18px] w-[18px] text-muted-foreground" />
          )}
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Уведомления</h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Прочитать все
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Нет уведомлений</p>
            </div>
          ) : (
            notifications.map((n: any) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-accent/50 ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {notificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-medium" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/70">
                        {timeAgo(n.createdAt)}
                      </span>
                      {n.link && (
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
