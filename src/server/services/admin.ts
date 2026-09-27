import { db } from "@/lib/db";
import { conflict, invalid, isUniqueConstraintError, notFound } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import {
  amenitySchema,
  categorySchema,
  changeRoleSchema,
  citySchema,
  countrySchema,
  neighborhoodSchema,
  reportResolutionSchema,
  siteSettingsSchema,
} from "@/lib/validation/admin";
import { ROLE_LABELS } from "@/lib/labels";
import { logActivity } from "@/server/services/activity";
import { createPasswordResetLink, parseOrThrow } from "@/server/services/auth";
import { notifyUser } from "@/server/services/notifications";
import { assertRole, type Actor } from "@/server/services/permissions";
import { saveSiteSettings } from "@/server/services/settings";
import { deleteUserSessions } from "@/server/services/sessions";

function requireAdmin(actor: Actor) {
  assertRole(actor, ["ADMIN"], "Administrator access is required.");
}

// ─── Users ────────────────────────────────────────────────────

export async function changeUserRole(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(changeRoleSchema, input);
  if (data.userId === admin.id) throw conflict("You can't change your own role.");

  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: data.userId }, select: { id: true, role: true, name: true, email: true, phone: true } });
    if (!user) throw notFound("User not found.");
    if (user.role === data.role) return;
    if (user.role === "ADMIN") {
      await tx.$queryRaw`SELECT \`id\` FROM \`User\` WHERE \`role\` = 'ADMIN' FOR UPDATE`;
      const admins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) throw conflict("There must always be at least one active administrator.");
    }
    await tx.user.update({ where: { id: user.id }, data: { role: data.role } });
    // Force re-authentication so the new permissions apply everywhere immediately.
    await tx.session.deleteMany({ where: { userId: user.id } });
    await logActivity(
      {
        actorId: admin.id,
        action: "user.role_changed",
        entityType: "User",
        entityId: user.id,
        summary: `Changed ${user.email ?? user.phone ?? user.name} from ${ROLE_LABELS[user.role]} to ${ROLE_LABELS[data.role]}`,
        metadata: { from: user.role, to: data.role },
      },
      tx,
    );
  });
}

export async function setUserSuspended(admin: Actor, userId: string, suspend: boolean) {
  requireAdmin(admin);
  if (userId === admin.id) throw conflict("You can't suspend your own account.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, phone: true, role: true, status: true } });
  if (!user) throw notFound("User not found.");
  if (suspend && user.role === "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw conflict("There must always be at least one active administrator.");
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
    if (suspend) {
      await tx.session.deleteMany({ where: { userId } });
      // Hide a suspended owner's listings from the public site.
      await tx.property.updateMany({ where: { ownerId: userId, status: "PUBLISHED" }, data: { status: "PAUSED" } });
    }
    await logActivity(
      { actorId: admin.id, action: suspend ? "user.suspended" : "user.reactivated", entityType: "User", entityId: userId, summary: `${suspend ? "Suspended" : "Reactivated"} ${user.email ?? user.phone}` },
      tx,
    );
  });
  if (suspend) await deleteUserSessions(userId);
}

export async function adminCreateResetLink(admin: Actor, userId: string) {
  requireAdmin(admin);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, phone: true, status: true } });
  if (!user) throw notFound("User not found.");
  if (user.status !== "ACTIVE") throw conflict("Reactivate the account before creating a reset link.");
  const { url } = await createPasswordResetLink(user.id);
  await logActivity({ actorId: admin.id, action: "user.reset_link_created", entityType: "User", entityId: user.id, summary: `Created a password reset link for ${user.email ?? user.phone}` });
  return url;
}

// ─── Reports ──────────────────────────────────────────────────

export async function resolveReport(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(reportResolutionSchema, input);
  const report = await db.report.findUnique({
    where: { id: data.reportId },
    select: { id: true, status: true, reporterId: true, property: { select: { id: true, title: true, status: true, ownerId: true } } },
  });
  if (!report) throw notFound("Report not found.");
  if (report.status !== "OPEN") throw conflict("This report has already been reviewed.");

  const unpublish = data.unpublishListing && ["PUBLISHED", "PAUSED", "RENTED"].includes(report.property.status);
  await db.$transaction(async (tx) => {
    const updated = await tx.report.updateMany({
      where: { id: report.id, status: "OPEN" },
      data: { status: data.status, resolutionNote: data.resolutionNote, resolvedById: admin.id, resolvedAt: new Date() },
    });
    if (updated.count !== 1) throw conflict("This report has already been reviewed.");
    if (unpublish) {
      await tx.property.update({
        where: { id: report.property.id },
        data: { status: "UNPUBLISHED", isFeatured: false, rejectionReason: data.resolutionNote, reviewedAt: new Date(), reviewedById: admin.id },
      });
    }
    await logActivity(
      {
        actorId: admin.id,
        action: `report.${data.status.toLowerCase()}`,
        entityType: "Report",
        entityId: report.id,
        summary: `${data.status === "RESOLVED" ? "Resolved" : "Dismissed"} report on "${report.property.title}"${unpublish ? " and unpublished the listing" : ""}`,
        metadata: { note: data.resolutionNote, unpublished: unpublish },
      },
      tx,
    );
  });

  await notifyUser({
    userId: report.reporterId,
    type: "REPORT_UPDATED",
    title: "Your report was reviewed",
    body: `Thanks for reporting "${report.property.title}". Our team has reviewed it.`,
    category: "listing",
  });
  if (unpublish) {
    await notifyUser({
      userId: report.property.ownerId,
      type: "LISTING_UNPUBLISHED",
      title: "Your listing was unpublished",
      body: `"${report.property.title}" was unpublished after a review. Reason: ${data.resolutionNote}`,
      link: `/dashboard/listings/${report.property.id}`,
      category: "listing",
    });
  }
}

// ─── Locations & catalogue ────────────────────────────────────

function withSlug<T extends { name: string; slug?: string }>(data: T) {
  const slug = data.slug || slugify(data.name);
  if (!slug) throw invalid("Enter a slug using letters or numbers.", { slug: ["Enter a slug"] });
  return slug;
}

async function uniqueGuard<T>(operation: () => Promise<T>, message: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw invalid(message, { slug: [message] });
    throw error;
  }
}

export async function createCountry(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(countrySchema, input);
  const country = await uniqueGuard(
    () => db.country.create({ data: { ...data, locale: `en-${data.code}` } }),
    "A country with this code already exists.",
  );
  await logActivity({ actorId: admin.id, action: "country.created", entityType: "Country", entityId: country.id, summary: `Added country ${country.name} (${country.currencyCode})` });
}

export async function saveCity(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(citySchema, input);
  const slug = withSlug(data);
  const country = await db.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw invalid("Choose a valid country.");
  const values = { countryId: data.countryId, name: data.name, slug, sortOrder: data.sortOrder, isActive: data.isActive, latitude: data.latitude ?? null, longitude: data.longitude ?? null };
  const city = await uniqueGuard(
    () => (data.id ? db.city.update({ where: { id: data.id }, data: values }) : db.city.create({ data: values })),
    "A city with this slug already exists in that country.",
  );
  await logActivity({ actorId: admin.id, action: data.id ? "city.updated" : "city.created", entityType: "City", entityId: city.id, summary: `${data.id ? "Updated" : "Added"} city ${city.name}${city.isActive ? "" : " (inactive)"}` });
}

export async function saveNeighborhood(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(neighborhoodSchema, input);
  const slug = withSlug(data);
  const city = await db.city.findUnique({ where: { id: data.cityId } });
  if (!city) throw invalid("Choose a valid city.");
  const values = { cityId: data.cityId, name: data.name, slug, isActive: data.isActive };
  const area = await uniqueGuard(
    () => (data.id ? db.neighborhood.update({ where: { id: data.id }, data: values }) : db.neighborhood.create({ data: values })),
    "An area with this slug already exists in that city.",
  );
  await logActivity({ actorId: admin.id, action: data.id ? "area.updated" : "area.created", entityType: "Neighborhood", entityId: area.id, summary: `${data.id ? "Updated" : "Added"} area ${area.name}, ${city.name}${area.isActive ? "" : " (inactive)"}` });
}

export async function saveCategory(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(categorySchema, input);
  const slug = withSlug(data);
  const values = {
    name: data.name,
    pluralName: data.pluralName,
    slug,
    description: data.description ?? null,
    icon: data.icon,
    usesRoomTypes: data.usesRoomTypes,
    isCommercial: data.isCommercial,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };
  const category = await uniqueGuard(
    () => (data.id ? db.propertyCategory.update({ where: { id: data.id }, data: values }) : db.propertyCategory.create({ data: values })),
    "A category with this slug already exists.",
  );
  await logActivity({ actorId: admin.id, action: data.id ? "category.updated" : "category.created", entityType: "PropertyCategory", entityId: category.id, summary: `${data.id ? "Updated" : "Added"} category ${category.name}${category.isActive ? "" : " (inactive)"}` });
}

export async function saveAmenity(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(amenitySchema, input);
  const slug = withSlug(data);
  const values = { name: data.name, slug, group: data.group, icon: data.icon, isActive: data.isActive, sortOrder: data.sortOrder };
  const amenity = await uniqueGuard(
    () => (data.id ? db.amenity.update({ where: { id: data.id }, data: values }) : db.amenity.create({ data: values })),
    "An amenity with this slug already exists.",
  );
  await logActivity({ actorId: admin.id, action: data.id ? "amenity.updated" : "amenity.created", entityType: "Amenity", entityId: amenity.id, summary: `${data.id ? "Updated" : "Added"} amenity ${amenity.name}${amenity.isActive ? "" : " (inactive)"}` });
}

export async function updateSiteSettings(admin: Actor, input: unknown) {
  requireAdmin(admin);
  const data = parseOrThrow(siteSettingsSchema, input);
  await saveSiteSettings(data, admin.id);
  await logActivity({ actorId: admin.id, action: "settings.updated", entityType: "SiteSetting", entityId: "general", summary: "Updated website settings", metadata: JSON.parse(JSON.stringify(data)) });
}
