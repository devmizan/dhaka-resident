"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationPreview } from "@/server/queries/notifications";
import { markNotificationReadQuietlyAction, markNotificationsReadAction } from "@/server/actions/interactions";

const POLL_MS = 30_000;

type Summary = { unread: number; items: NotificationPreview[] };

export function NotificationBell({ initial }: { initial: Summary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const seenIds = useRef(new Set(initial.items.map((i) => i.id)));

  // Adopt fresh server data when the page re-renders (e.g. after an action elsewhere on the page).
  const initialKey = `${initial.unread}:${initial.items.map((i) => `${i.id}${i.read ? 1 : 0}`).join(",")}`;
  const [lastInitialKey, setLastInitialKey] = useState(initialKey);
  if (initialKey !== lastInitialKey) {
    setLastInitialKey(initialKey);
    setSummary(initial);
  }

  const refresh = useCallback(
    async ({ announce }: { announce: boolean }) => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as Summary;
        const fresh = next.items.filter((item) => !item.read && !seenIds.current.has(item.id));
        next.items.forEach((item) => seenIds.current.add(item.id));
        setSummary(next);
        if (announce && fresh.length) {
          const latest = fresh[0]!;
          toast(latest.title, {
            description: fresh.length > 1 ? `${latest.body} (+${fresh.length - 1} more)` : latest.body,
            icon: <Bell className="size-4 text-emerald-700" />,
            duration: 10_000,
            action: latest.link ? { label: "View", onClick: () => router.push(latest.link!) } : undefined,
          });
          // Keep server-rendered counts (dashboard sidebar etc.) in sync.
          router.refresh();
        }
      } catch {
        // Network hiccups are ignored; the next poll will try again.
      }
    },
    [router],
  );

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh({ announce: true });
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLoading(true);
      void refresh({ announce: false }).finally(() => setLoading(false));
    }
  }

  function openItem(item: NotificationPreview) {
    setOpen(false);
    if (item.read) return;
    setSummary((s) => ({ unread: Math.max(0, s.unread - 1), items: s.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)) }));
    // Uses an action that doesn't re-render the page, so it can't interrupt the link navigation.
    void markNotificationReadQuietlyAction(item.id);
  }

  function markAllRead() {
    setSummary((s) => ({ unread: 0, items: s.items.map((i) => ({ ...i, read: true })) }));
    startTransition(async () => {
      const result = await markNotificationsReadAction();
      if (!result.ok) toast.error(result.error);
    });
  }

  const { unread, items } = summary;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-5" />
          {unread ? (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] leading-4 font-bold text-white" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0" aria-label="Notifications">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold text-navy-900">
            Notifications
            {unread ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{unread} new</span> : null}
            {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" /> : null}
          </p>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread || pending}>
            <CheckCheck data-icon="inline-start" />
            Mark all read
          </Button>
        </div>

        {items.length ? (
          <ul className="max-h-[min(420px,60vh)] divide-y overflow-y-auto" role="list">
            {items.map((item) => {
              const itemClass = cn(
                "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-navy-50 focus-visible:bg-navy-50 focus-visible:outline-none",
                !item.read && "bg-emerald-50/50",
              );
              const content = (
                <>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-emerald-600")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm text-navy-900", item.read ? "font-medium" : "font-bold")}>
                      {item.title}
                      {!item.read ? <span className="sr-only"> (unread)</span> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-navy-700">{item.body}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {item.link ? (
                    <Link href={item.link} onClick={() => openItem(item)} className={itemClass}>
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => openItem(item)} className={itemClass}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <BellOff className="size-6 text-navy-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-navy-900">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">Updates about enquiries, viewings and listings appear here.</p>
          </div>
        )}

        <div className="border-t p-2">
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="flex h-10 items-center justify-center rounded-lg text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
