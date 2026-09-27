import { db } from "@/lib/db";
import { conflict, invalid, notFound } from "@/lib/errors";
import { reportSchema } from "@/lib/validation/interactions";
import { notificationPreferencesSchema, phoneUpdateSchema, profileSchema } from "@/lib/validation/auth";
import { parseOrThrow } from "@/server/services/auth";
import { notifyAdmins } from "@/server/services/notifications";
import { assertRole, type Actor } from "@/server/services/permissions";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";

export async function setFavorite(actor: Actor, propertyId: string, saved: boolean) {
  assertRole(actor, ["TENANT"], "Sign in with a tenant account to save properties.");
  if (saved) {
    const property = await db.property.findUnique({ where: { id: propertyId }, select: { status: true } });
    if (!property || property.status !== "PUBLISHED") throw notFound("This listing is no longer available.");
    await db.favorite.upsert({
      where: { userId_propertyId: { userId: actor.id, propertyId } },
      create: { userId: actor.id, propertyId },
      update: {},
    });
  } else {
    await db.favorite.deleteMany({ where: { userId: actor.id, propertyId } });
  }
  return saved;
}

export async function reportListing(actor: Actor, input: unknown) {
  const data = parseOrThrow(reportSchema, input);
  const property = await db.property.findUnique({ where: { id: data.propertyId }, select: { id: true, ownerId: true, title: true, status: true } });
  if (!property || property.status !== "PUBLISHED") throw notFound("This listing is no longer available.");
  if (property.ownerId === actor.id) throw conflict("You can't report your own listing.");

  const open = await db.report.findFirst({ where: { propertyId: property.id, reporterId: actor.id, status: "OPEN" }, select: { id: true } });
  if (open) throw conflict("You've already reported this listing. Our team will review it.");
  await enforceRateLimit(`report:${actor.id}`, RATE_LIMITS.report, "You've sent several reports today. Please try again tomorrow.");

  await db.report.create({ data: { propertyId: property.id, reporterId: actor.id, reason: data.reason, details: data.details } });
  await notifyAdmins({
    type: "REPORT_UPDATED",
    title: "New listing report",
    body: `A user reported "${property.title}".`,
    link: "/admin/reports",
    category: "listing",
  });
}

export async function updateProfile(actor: Actor, input: unknown) {
  const data = parseOrThrow(profileSchema, input);
  await db.user.update({
    where: { id: actor.id },
    data: {
      name: data.name,
      bio: data.bio ?? null,
      companyName: actor.role === "OWNER" ? (data.companyName ?? null) : null,
    },
  });
}

/** Saves or removes an unverified mobile number. Verified numbers are set through a one-time code instead. */
export async function updatePhone(actor: Actor, input: unknown) {
  const data = parseOrThrow(phoneUpdateSchema, input);
  const current = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { phone: true, email: true } });
  const phone = data.phone ?? null;
  if (phone === current.phone) return;
  if (phone && (await db.user.findFirst({ where: { phone, id: { not: actor.id } }, select: { id: true } }))) {
    throw invalid("This mobile number is used by another account.", { phone: ["This mobile number is used by another account."] });
  }
  // Without an email, the phone number is the only way to log in with a code.
  if (!current.email && !phone) {
    throw invalid("You signed up with your mobile number, so it can't be removed.", { phone: ["Your mobile number is needed to log in."] });
  }
  await db.user.update({ where: { id: actor.id }, data: { phone, phoneVerifiedAt: null } });
}

export async function updateNotificationPreferences(actor: Actor, input: unknown) {
  const data = parseOrThrow(notificationPreferencesSchema, input);
  await db.user.update({ where: { id: actor.id }, data });
}

export async function markNotificationsRead(actor: Actor, notificationId?: string) {
  await db.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(notificationId ? { id: notificationId } : {}) },
    data: { readAt: new Date() },
  });
}
