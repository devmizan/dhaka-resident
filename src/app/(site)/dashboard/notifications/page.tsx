import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { EmptyState, Notice, PageHeader } from "@/components/common/misc";
import { Pagination } from "@/components/common/pagination";
import { MarkAllReadButton, NotificationList } from "@/components/dashboard/notification-list";
import { requirePageUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { getNotifications } from "@/server/queries/dashboard";
import { isEmailConfigured } from "@/server/services/email";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/dashboard/notifications">) {
  const user = await requirePageUser(undefined, "/dashboard/notifications");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, pageCount } = await getNotifications(user.id, page);
  const unread = items.some((i) => !i.readAt);

  return (
    <>
      <PageHeader title="Notifications" description="Updates about your enquiries, viewings and listings." actions={<MarkAllReadButton disabled={!unread} />} />
      {!isEmailConfigured() ? (
        <Notice tone="warning" className="mt-5" title="Email notifications are not being sent">
          Email delivery isn&apos;t configured on this server, so notifications are shown here in the app only.
        </Notice>
      ) : null}
      <div className="mt-5">
        {items.length ? (
          <NotificationList items={items.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: Boolean(n.readAt), time: formatRelative(n.createdAt) }))} />
        ) : (
          <EmptyState icon={Bell} title="You're all caught up" description="New activity on your account will appear here." />
        )}
      </div>
      <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => `/dashboard/notifications?page=${p}`} />
    </>
  );
}
