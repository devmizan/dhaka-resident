import { db } from "@/lib/db";

export type NotificationPreview = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

export async function getNotificationSummary(userId: string, take = 8): Promise<{ unread: number; items: NotificationPreview[] }> {
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: n.readAt !== null, createdAt: n.createdAt.toISOString() })),
  };
}
