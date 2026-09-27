"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationReadQuietlyAction, markNotificationsReadAction } from "@/server/actions/interactions";

type Item = { id: string; title: string; body: string; link: string | null; read: boolean; time: string };

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" disabled={disabled || pending} onClick={() => startTransition(async () => void (await markNotificationsReadAction()))}>
      {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <CheckCheck data-icon="inline-start" />}
      Mark all as read
    </Button>
  );
}

export function NotificationList({ items }: { items: Item[] }) {
  const [, startTransition] = useTransition();
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-white">
      {items.map((item) => {
        const content = (
          <>
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-emerald-600")} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-navy-900", item.read ? "font-medium" : "font-bold")}>
                {item.title}
                {!item.read ? <span className="sr-only"> (unread)</span> : null}
              </span>
              <span className="block text-sm text-navy-700">{item.body}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.time}</span>
            </span>
          </>
        );
        const onOpen = () => {
          if (item.read) return;
          // Links navigate away, so use the action that doesn't re-render the current page.
          if (item.link) void markNotificationReadQuietlyAction(item.id);
          else startTransition(async () => void (await markNotificationsReadAction(item.id)));
        };
        return (
          <li key={item.id}>
            {item.link ? (
              <Link href={item.link} onClick={onOpen} className={cn("flex gap-3 p-4 hover:bg-navy-50/60", !item.read && "bg-emerald-50/40")}>
                {content}
              </Link>
            ) : (
              <button type="button" onClick={onOpen} className={cn("flex w-full gap-3 p-4 text-left hover:bg-navy-50/60", !item.read && "bg-emerald-50/40")}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
