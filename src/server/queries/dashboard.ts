import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/server/services/sessions";
import { LISTING_CARD_SELECT, toCardData } from "@/server/queries/listings";

/** Unread = the other participant wrote after this user last read the thread. */
async function countUnreadConversations(user: SessionUser) {
  const isOwner = user.role === "OWNER";
  const rows = await db.enquiry.findMany({
    where: isOwner ? { ownerId: user.id } : { tenantId: user.id },
    select: {
      tenantLastReadAt: true,
      ownerLastReadAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } },
    },
  });
  return rows.filter((row) => {
    const last = row.messages[0];
    if (!last || last.senderId === user.id) return false;
    const readAt = isOwner ? row.ownerLastReadAt : row.tenantLastReadAt;
    return !readAt || readAt < last.createdAt;
  }).length;
}

export async function getDashboardCounts(user: SessionUser) {
  const [unreadConversations, pendingViewings, unreadNotifications] = await Promise.all([
    user.role === "ADMIN" ? 0 : countUnreadConversations(user),
    user.role === "OWNER"
      ? db.viewingRequest.count({ where: { ownerId: user.id, status: "PENDING", startsAt: { gt: new Date() } } })
      : user.role === "TENANT"
        ? db.viewingRequest.count({ where: { tenantId: user.id, status: "ACCEPTED", startsAt: { gt: new Date() } } })
        : 0,
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { unreadConversations, pendingViewings, unreadNotifications };
}

export async function getTenantOverview(userId: string) {
  const now = new Date();
  const [saved, enquiries, upcoming, pending] = await Promise.all([
    db.favorite.count({ where: { userId, property: { status: "PUBLISHED" } } }),
    db.enquiry.count({ where: { tenantId: userId } }),
    db.viewingRequest.findMany({
      where: { tenantId: userId, status: { in: ["PENDING", "ACCEPTED"] }, startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, status: true, startsAt: true, property: { select: { title: true, slug: true, city: { select: { country: { select: { timeZone: true } } } } } } },
    }),
    db.viewingRequest.count({ where: { tenantId: userId, status: "PENDING", startsAt: { gt: now } } }),
  ]);
  return { saved, enquiries, upcoming, pending };
}

export async function getOwnerOverview(userId: string) {
  const now = new Date();
  const [byStatus, openEnquiries, pendingViewings, upcoming] = await Promise.all([
    db.property.groupBy({ by: ["status"], where: { ownerId: userId }, _count: { _all: true } }),
    db.enquiry.count({ where: { ownerId: userId, status: "OPEN" } }),
    db.viewingRequest.count({ where: { ownerId: userId, status: "PENDING", startsAt: { gt: now } } }),
    db.viewingRequest.findMany({
      where: { ownerId: userId, status: "ACCEPTED", startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, startsAt: true, tenant: { select: { name: true } }, property: { select: { title: true, city: { select: { country: { select: { timeZone: true } } } } } } },
    }),
  ]);
  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  return {
    published: count("PUBLISHED"),
    pending: count("PENDING_REVIEW"),
    drafts: count("DRAFT") + count("REJECTED"),
    total: byStatus.reduce((sum, s) => sum + s._count._all, 0),
    openEnquiries,
    pendingViewings,
    upcoming,
  };
}

export async function getSavedListings(userId: string) {
  const favorites = await db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, property: { select: LISTING_CARD_SELECT } },
  });
  return favorites.map((f) => ({ savedAt: f.createdAt, available: f.property.status === "PUBLISHED", listing: toCardData(f.property) }));
}

export async function getConversationList(user: SessionUser, filter: { status?: "OPEN" | "CLOSED"; propertyId?: string }) {
  const isOwner = user.role === "OWNER";
  const where: Prisma.EnquiryWhereInput = {
    ...(isOwner ? { ownerId: user.id } : { tenantId: user.id }),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
  };
  const rows = await db.enquiry.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      lastMessageAt: true,
      tenantLastReadAt: true,
      ownerLastReadAt: true,
      property: { select: { id: true, title: true, slug: true, isDemo: true, photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
      tenant: { select: { name: true } },
      owner: { select: { name: true, companyName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
    },
  });
  return rows.map((row) => {
    const last = row.messages[0];
    const readAt = isOwner ? row.ownerLastReadAt : row.tenantLastReadAt;
    return {
      id: row.id,
      status: row.status,
      lastMessageAt: row.lastMessageAt,
      property: row.property,
      counterpart: isOwner ? row.tenant.name : (row.owner.companyName ?? row.owner.name),
      preview: last ? `${last.senderId === user.id ? "You: " : ""}${last.body}` : "",
      unread: Boolean(last && last.senderId !== user.id && (!readAt || readAt < last.createdAt)),
    };
  });
}

/** Loads a thread for one of its participants, or null (callers render 404 for everyone else). */
export async function getConversation(user: SessionUser, enquiryId: string) {
  const enquiry = await db.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      status: true,
      tenantId: true,
      ownerId: true,
      moveInDate: true,
      occupants: true,
      createdAt: true,
      property: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          isDemo: true,
          rentAmount: true,
          billingPeriod: true,
          currencyCode: true,
          category: { select: { usesRoomTypes: true } },
          photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          city: { select: { name: true, country: { select: { timeZone: true } } } },
          neighborhood: { select: { name: true } },
        },
      },
      tenant: { select: { id: true, name: true, phone: true, isDemo: true } },
      owner: { select: { id: true, name: true, companyName: true, isDemo: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500, select: { id: true, body: true, senderId: true, createdAt: true } },
      viewingRequests: { orderBy: { startsAt: "desc" }, select: { id: true, status: true, startsAt: true } },
    },
  });
  if (!enquiry || (enquiry.tenantId !== user.id && enquiry.ownerId !== user.id)) return null;
  return enquiry;
}

export async function getViewingsForUser(user: SessionUser, scope: "upcoming" | "past") {
  const now = new Date();
  const isOwner = user.role === "OWNER";
  return db.viewingRequest.findMany({
    where: {
      ...(isOwner ? { ownerId: user.id } : { tenantId: user.id }),
      ...(scope === "upcoming" ? { endsAt: { gt: now } } : { endsAt: { lte: now } }),
    },
    orderBy: { startsAt: scope === "upcoming" ? "asc" : "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      tenantNote: true,
      ownerNote: true,
      slotId: true,
      enquiryId: true,
      createdAt: true,
      property: { select: { id: true, title: true, slug: true, approximateArea: true, neighborhood: { select: { name: true } }, city: { select: { name: true, country: { select: { timeZone: true } } } } } },
      tenant: { select: { name: true, phone: true } },
      owner: { select: { name: true, companyName: true } },
    },
  });
}

export async function getNotifications(userId: string, page: number) {
  const take = 30;
  const [items, total] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    db.notification.count({ where: { userId } }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / take)) };
}
