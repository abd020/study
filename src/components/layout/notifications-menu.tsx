import { Bell, BellOff, CalendarClock, CheckCheck, Layers, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-account";
import { formatRelative } from "@/lib/format";
import type { NotificationType } from "@/types/database";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, typeof Bell> = {
  exam_reminder: CalendarClock,
  review_due: Layers,
  streak: Trophy,
  achievement: Trophy,
  system: Bell,
};

export function NotificationsMenu() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout lire
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = ICONS[notification.type];
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => !notification.read && markRead.mutate(notification.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent/60",
                    !notification.read && "bg-accent/40",
                  )}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{notification.title}</span>
                    {notification.message ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{notification.message}</span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatRelative(notification.created_at)}
                    </span>
                  </span>
                  {!notification.read ? (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
