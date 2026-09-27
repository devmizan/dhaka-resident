import type { Prisma } from "@/generated/prisma/client";
import type { ListingStatus, ReportStatus, Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export async function getAdminOverview() {
  const [usersByRole, listingsByStatus, openReports, recentActivity, pendingListings, emailsSkipped, suspended] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.property.groupBy({ by: ["status"], _count: { _all: true } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.adminActivity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    db.property.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { submittedAt: "asc" },
      take: 5,
      select: { id: true, title: true, slug: true, submittedAt: true, owner: { select: { name: true } }, category: { select: { name: true } }, city: { select: { name: true } } },
    }),
    db.emailLog.count({ where: { status: "SKIPPED", createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
  ]);
  const roleCount = (role: Role) => usersByRole.find((r) => r.role === role)?._count._all ?? 0;
  const statusCount = (status: ListingStatus) => listingsByStatus.find((s) => s.status === status)?._count._all ?? 0;
  return {
    users: { total: usersByRole.reduce((s, r) => s + r._count._all, 0), tenants: roleCount("TENANT"), owners: roleCount("OWNER"), admins: roleCount("ADMIN"), suspended },
    listings: { total: listingsByStatus.reduce((s, r) => s + r._count._all, 0), published: statusCount("PUBLISHED"), pending: statusCount("PENDING_REVIEW"), rejected: statusCount("REJECTED"), unpublished: statusCount("UNPUBLISHED") },
    openReports,
    recentActivity,
    pendingListings,
    emailsSkipped,
  };
}

export async function getAdminListings(filters: { status?: ListingStatus; q?: string; page: number }) {
  const take = 20;
  const where: Prisma.PropertyWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { owner: { email: { contains: filters.q } } },
            { owner: { name: { contains: filters.q } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.property.findMany({
      where,
      orderBy: filters.status === "PENDING_REVIEW" ? { submittedAt: "asc" } : { updatedAt: "desc" },
      skip: (filters.page - 1) * take,
      take,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        isDemo: true,
        isFeatured: true,
        rentAmount: true,
        billingPeriod: true,
        currencyCode: true,
        submittedAt: true,
        updatedAt: true,
        rejectionReason: true,
        category: { select: { name: true, usesRoomTypes: true } },
        city: { select: { name: true } },
        neighborhood: { select: { name: true } },
        owner: { select: { name: true, email: true, phone: true } },
        photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        _count: { select: { photos: true, reports: { where: { status: "OPEN" } } } },
      },
    }),
    db.property.count({ where }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / take)) };
}

export async function getAdminUsers(filters: { role?: Role; q?: string; page: number }) {
  const take = 25;
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.q
      ? {
          OR: [
            { email: { contains: filters.q } },
            { name: { contains: filters.q } },
            ...(filters.q.replace(/\D/g, "").length >= 4 ? [{ phone: { contains: filters.q.replace(/\D/g, "").replace(/^0/, "") } }] : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * take,
      take,
      select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, passwordHash: true, role: true, status: true, isDemo: true, createdAt: true, lastLoginAt: true, _count: { select: { properties: true } } },
    }),
    db.user.count({ where }),
  ]);
  const items = rows.map(({ passwordHash, ...user }) => ({ ...user, hasPassword: passwordHash !== null }));
  return { items, total, pageCount: Math.max(1, Math.ceil(total / take)) };
}

export async function getAdminReports(status: ReportStatus | undefined, page: number) {
  const take = 20;
  const where: Prisma.ReportWhereInput = status ? { status } : {};
  const [items, total, counts] = await Promise.all([
    db.report.findMany({
      where,
      orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        property: { select: { id: true, title: true, slug: true, status: true, isDemo: true, owner: { select: { name: true, email: true, phone: true } } } },
        reporter: { select: { name: true, email: true, phone: true } },
        resolvedBy: { select: { name: true } },
      },
    }),
    db.report.count({ where }),
    db.report.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    items,
    total,
    pageCount: Math.max(1, Math.ceil(total / take)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ReportStatus, number>>,
  };
}

export async function getActivityLog(page: number, entityType?: string) {
  const take = 40;
  const where: Prisma.AdminActivityWhereInput = entityType ? { entityType } : {};
  const [items, total] = await Promise.all([
    db.adminActivity.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { actor: { select: { name: true, email: true } } } }),
    db.adminActivity.count({ where }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / take)) };
}

export async function getCatalogue() {
  const [countries, categories, amenities] = await Promise.all([
    db.country.findMany({
      orderBy: { name: "asc" },
      include: {
        cities: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { neighborhoods: { orderBy: { name: "asc" }, include: { _count: { select: { properties: true } } } }, _count: { select: { properties: true } } },
        },
      },
    }),
    db.propertyCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { properties: true } } } }),
    db.amenity.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }], include: { _count: { select: { properties: true } } } }),
  ]);
  return { countries, categories, amenities };
}
