import type { ListingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export async function getOwnerListings(ownerId: string, status?: ListingStatus) {
  return db.property.findMany({
    where: { ownerId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      isDemo: true,
      rentAmount: true,
      billingPeriod: true,
      currencyCode: true,
      rejectionReason: true,
      updatedAt: true,
      publishedAt: true,
      category: { select: { name: true, usesRoomTypes: true } },
      city: { select: { name: true } },
      neighborhood: { select: { name: true } },
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      _count: { select: { enquiries: true, favorites: false } },
      viewingRequests: { where: { status: "PENDING", startsAt: { gt: new Date() } }, select: { id: true } },
    },
  });
}

export async function getOwnerListingStatusCounts(ownerId: string) {
  const rows = await db.property.groupBy({ by: ["status"], where: { ownerId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ListingStatus, number>>;
}

/** Full listing for the editor — only for its owner. */
export async function getListingForEditor(ownerId: string, propertyId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: {
      category: true,
      city: { include: { country: true } },
      neighborhood: true,
      photos: { orderBy: { sortOrder: "asc" } },
      amenities: { select: { amenityId: true } },
      roomTypes: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!property || property.ownerId !== ownerId) return null;
  return property;
}

export type EditorListing = NonNullable<Awaited<ReturnType<typeof getListingForEditor>>>;

export async function getEditorReferenceData() {
  const [categories, cities, amenities] = await Promise.all([
    db.propertyCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.city.findMany({
      where: { isActive: true, country: { isActive: true } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, country: { select: { name: true } }, neighborhoods: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    db.amenity.findMany({ where: { isActive: true }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return { categories, cities, amenities };
}

export async function getListingManagementData(ownerId: string, propertyId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      ownerId: true,
      slug: true,
      title: true,
      status: true,
      isDemo: true,
      publishedAt: true,
      submittedAt: true,
      rejectionReason: true,
      availableFrom: true,
      rentAmount: true,
      billingPeriod: true,
      currencyCode: true,
      updatedAt: true,
      category: { select: { name: true, usesRoomTypes: true } },
      city: { select: { name: true, country: { select: { timeZone: true, name: true } } } },
      neighborhood: { select: { name: true } },
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      roomTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, totalBeds: true, availableBeds: true, pricePerBed: true } },
      viewingSlots: {
        where: { isCancelled: false, endsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, endsAt: true, note: true, viewingRequests: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, select: { status: true, tenant: { select: { name: true } } } } },
      },
      _count: { select: { enquiries: true, favorites: true } },
    },
  });
  if (!property || property.ownerId !== ownerId) return null;
  const pendingViewings = await db.viewingRequest.count({ where: { propertyId, status: "PENDING", startsAt: { gt: new Date() } } });
  return { ...property, pendingViewings };
}
