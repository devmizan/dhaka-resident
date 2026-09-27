import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parseCalendarDate } from "@/lib/dates";
import { PAGE_SIZE, relevanceScore, searchTerms, type SearchFilters } from "@/lib/search-params";

export const LISTING_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  isDemo: true,
  isFeatured: true,
  status: true,
  rentAmount: true,
  billingPeriod: true,
  currencyCode: true,
  bedrooms: true,
  bathrooms: true,
  floorAreaSqft: true,
  furnishing: true,
  bathroomType: true,
  availableFrom: true,
  approximateArea: true,
  publishedAt: true,
  category: { select: { name: true, slug: true, usesRoomTypes: true } },
  city: { select: { name: true, slug: true } },
  neighborhood: { select: { name: true, slug: true } },
  photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
  roomTypes: { select: { availableBeds: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.PropertySelect;

type CardRow = Prisma.PropertyGetPayload<{ select: typeof LISTING_CARD_SELECT }>;

export type ListingCardData = ReturnType<typeof toCardData>;

export function toCardData(row: CardRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    isDemo: row.isDemo,
    isFeatured: row.isFeatured,
    rentAmount: row.rentAmount,
    billingPeriod: row.billingPeriod,
    currencyCode: row.currencyCode,
    perBed: row.category.usesRoomTypes,
    categoryName: row.category.name,
    locationLabel: [row.neighborhood?.name, row.city?.name].filter(Boolean).join(", "),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    floorAreaSqft: row.floorAreaSqft,
    furnishing: row.furnishing,
    bathroomType: row.bathroomType,
    availableFrom: row.availableFrom?.toISOString() ?? null,
    availableBeds: row.category.usesRoomTypes ? row.roomTypes.reduce((sum, r) => sum + r.availableBeds, 0) : null,
    photo: row.photos[0] ?? null,
    photoCount: row._count.photos,
  };
}

export function buildSearchWhere(filters: SearchFilters): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [{ status: "PUBLISHED" }];

  if (filters.city) and.push({ city: { slug: filters.city } });
  if (filters.area) and.push({ neighborhood: { slug: filters.area } });
  if (filters.type) and.push({ category: { slug: filters.type } });
  if (filters.minRent !== undefined || filters.maxRent !== undefined) {
    and.push({ rentAmount: { gte: filters.minRent, lte: filters.maxRent } });
  }
  if (filters.period) and.push({ billingPeriod: filters.period });
  if (filters.beds !== undefined) and.push({ bedrooms: { gte: filters.beds } });
  if (filters.baths !== undefined) and.push({ bathrooms: { gte: filters.baths } });
  if (filters.minArea !== undefined || filters.maxArea !== undefined) {
    and.push({ floorAreaSqft: { gte: filters.minArea, lte: filters.maxArea } });
  }
  if (filters.furnishing.length) and.push({ furnishing: { in: filters.furnishing } });
  if (filters.available) {
    const date = parseCalendarDate(filters.available);
    if (date) and.push({ availableFrom: { lte: date } });
  }
  if (filters.bathroom) {
    // Hostels and shared rooms describe bathrooms per room type.
    and.push({ OR: [{ bathroomType: filters.bathroom }, { roomTypes: { some: { bathroomType: filters.bathroom } } }] });
  }
  for (const slug of filters.amenities) {
    and.push({ amenities: { some: { amenity: { slug } } } });
  }
  if (filters.pets === "allowed") and.push({ petPolicy: "ALLOWED" });
  if (filters.pets === "considered") and.push({ petPolicy: { in: ["ALLOWED", "NEGOTIABLE"] } });
  if (filters.hideDemo) and.push({ isDemo: false });

  for (const term of searchTerms(filters.q)) {
    // MariaDB's default collation is case-insensitive, so `contains` already ignores case.
    const contains = { contains: term };
    and.push({
      OR: [
        { title: contains },
        { description: contains },
        { approximateArea: contains },
        { city: { name: contains } },
        { neighborhood: { name: contains } },
        { category: { name: contains } },
        { category: { pluralName: contains } },
      ],
    });
  }
  return { AND: and };
}

const RELEVANCE_CANDIDATE_LIMIT = 500;

export async function searchListings(filters: SearchFilters) {
  const where = buildSearchWhere(filters);
  const total = await db.property.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const skip = (page - 1) * PAGE_SIZE;

  let rows: CardRow[];
  if (filters.sort === "relevance" && filters.q) {
    // Rank the (bounded) candidate set in application code, then load the page.
    const candidates = await db.property.findMany({
      where,
      take: RELEVANCE_CANDIDATE_LIMIT,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        approximateArea: true,
        isFeatured: true,
        publishedAt: true,
        city: { select: { name: true } },
        neighborhood: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    const terms = searchTerms(filters.q);
    const ranked = candidates
      .map((c) => ({
        id: c.id,
        score: relevanceScore(terms, {
          title: c.title,
          description: c.description,
          approximateArea: c.approximateArea,
          cityName: c.city?.name ?? "",
          areaName: c.neighborhood?.name ?? "",
          categoryName: c.category.name,
          isFeatured: c.isFeatured,
          publishedAt: c.publishedAt,
        }),
      }))
      .sort((a, b) => b.score - a.score);
    const pageIds = ranked.slice(skip, skip + PAGE_SIZE).map((r) => r.id);
    const pageRows = await db.property.findMany({ where: { id: { in: pageIds } }, select: LISTING_CARD_SELECT });
    rows = pageIds.map((id) => pageRows.find((r) => r.id === id)).filter((r): r is CardRow => Boolean(r));
  } else {
    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      filters.sort === "price_asc"
        ? [{ rentAmount: "asc" }, { publishedAt: "desc" }]
        : filters.sort === "price_desc"
          ? [{ rentAmount: "desc" }, { publishedAt: "desc" }]
          : filters.sort === "relevance"
            ? [{ isFeatured: "desc" }, { publishedAt: "desc" }]
            : [{ publishedAt: "desc" }, { id: "desc" }];
    rows = await db.property.findMany({ where, orderBy, skip, take: PAGE_SIZE, select: LISTING_CARD_SELECT });
  }

  return { items: rows.map(toCardData), total, page, pageCount };
}

export async function getFavoriteIds(userId: string | undefined, propertyIds: string[]): Promise<Set<string>> {
  if (!userId || propertyIds.length === 0) return new Set();
  const favorites = await db.favorite.findMany({ where: { userId, propertyId: { in: propertyIds } }, select: { propertyId: true } });
  return new Set(favorites.map((f) => f.propertyId));
}

export async function getHomepageData() {
  const [featured, recent, categories, areaCounts, cityCounts] = await Promise.all([
    db.property.findMany({
      where: { status: "PUBLISHED", isFeatured: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
      select: LISTING_CARD_SELECT,
    }),
    db.property.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 8, select: LISTING_CARD_SELECT }),
    db.propertyCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, pluralName: true, icon: true } }),
    db.property.groupBy({ by: ["neighborhoodId"], where: { status: "PUBLISHED", neighborhoodId: { not: null } }, _count: { _all: true } }),
    db.property.groupBy({ by: ["cityId"], where: { status: "PUBLISHED", cityId: { not: null } }, _count: { _all: true } }),
  ]);

  const topAreaIds = areaCounts
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8)
    .map((a) => a.neighborhoodId!);
  const [areas, cities] = await Promise.all([
    db.neighborhood.findMany({ where: { id: { in: topAreaIds } }, select: { id: true, name: true, slug: true, city: { select: { name: true, slug: true } } } }),
    db.city.findMany({ where: { id: { in: cityCounts.map((c) => c.cityId!) } }, select: { id: true, name: true, slug: true } }),
  ]);

  return {
    featured: featured.map(toCardData),
    recent: recent.map(toCardData),
    categories,
    popularAreas: topAreaIds
      .map((id) => {
        const area = areas.find((a) => a.id === id);
        const count = areaCounts.find((a) => a.neighborhoodId === id)?._count._all ?? 0;
        return area ? { ...area, count } : null;
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    cities: cities
      .map((city) => ({ ...city, count: cityCounts.find((c) => c.cityId === city.id)?._count._all ?? 0 }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getSearchFacets() {
  const [cities, categories, amenities] = await Promise.all([
    db.city.findMany({
      where: { isActive: true, country: { isActive: true } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, neighborhoods: { where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, slug: true } } },
    }),
    db.propertyCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, pluralName: true } }),
    db.amenity.findMany({ where: { isActive: true }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }], select: { slug: true, name: true, group: true } }),
  ]);
  return { cities, categories, amenities };
}

export type SearchFacets = Awaited<ReturnType<typeof getSearchFacets>>;

/** Rounds coordinates to roughly 1 km so the public map never pinpoints a home. */
export function approximateCoordinates(lat: number, lng: number) {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

export async function getPropertyForView(slug: string, viewer: { id: string; role: string } | null) {
  const property = await db.property.findUnique({
    where: { slug },
    include: {
      category: true,
      city: { include: { country: true } },
      neighborhood: true,
      photos: { orderBy: { sortOrder: "asc" } },
      amenities: { include: { amenity: true } },
      roomTypes: { orderBy: { sortOrder: "asc" } },
      owner: { select: { id: true, name: true, companyName: true, bio: true, createdAt: true, isDemo: true, role: true } },
    },
  });
  if (!property) return null;

  const isOwner = viewer?.id === property.ownerId;
  const isAdmin = viewer?.role === "ADMIN";
  if (property.status !== "PUBLISHED" && !isOwner && !isAdmin) return null;

  let canSeeAddress = isOwner || isAdmin || property.addressVisibility === "PUBLIC";
  if (!canSeeAddress && viewer && property.addressVisibility === "AFTER_ACCEPTED_VIEWING") {
    const accepted = await db.viewingRequest.count({ where: { propertyId: property.id, tenantId: viewer.id, status: "ACCEPTED" } });
    canSeeAddress = accepted > 0;
  }

  const baseLat = property.latitude ?? property.neighborhood?.latitude ?? property.city?.latitude ?? null;
  const baseLng = property.longitude ?? property.neighborhood?.longitude ?? property.city?.longitude ?? null;
  const mapCenter = baseLat !== null && baseLng !== null ? approximateCoordinates(baseLat, baseLng) : null;

  const {
    addressLine,
    latitude: _lat,
    longitude: _lng,
    ...rest
  } = property;
  void _lat;
  void _lng;

  return {
    ...rest,
    addressLine: canSeeAddress ? addressLine : null,
    addressHidden: !canSeeAddress && Boolean(addressLine),
    mapCenter,
    viewerIsOwner: isOwner,
    viewerIsAdmin: isAdmin,
  };
}

export type PropertyView = NonNullable<Awaited<ReturnType<typeof getPropertyForView>>>;

export async function getRelatedListings(property: { id: string; cityId: string | null; categoryId: string }) {
  if (!property.cityId) return [];
  const rows = await db.property.findMany({
    where: { status: "PUBLISHED", cityId: property.cityId, id: { not: property.id } },
    orderBy: [{ publishedAt: "desc" }],
    take: 12,
    select: { ...LISTING_CARD_SELECT, categoryId: true },
  });
  return rows
    .sort((a, b) => Number(b.categoryId === property.categoryId) - Number(a.categoryId === property.categoryId))
    .slice(0, 4)
    .map(toCardData);
}

export async function getOpenViewingSlots(propertyId: string) {
  const slots = await db.viewingSlot.findMany({
    where: { propertyId, isCancelled: false, startsAt: { gt: new Date(Date.now() + 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 20,
    select: { id: true, startsAt: true, endsAt: true, note: true, viewingRequests: { where: { status: "ACCEPTED" }, select: { id: true } } },
  });
  return slots.filter((s) => s.viewingRequests.length === 0).map((s) => ({ id: s.id, startsAt: s.startsAt, endsAt: s.endsAt, note: s.note }));
}
