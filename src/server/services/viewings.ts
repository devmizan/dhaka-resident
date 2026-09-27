import { db, type Tx } from "@/lib/db";
import { parseCalendarDate, zonedDateTimeToUtc } from "@/lib/dates";
import { DEFAULT_TIME_ZONE, formatDateTime } from "@/lib/format";
import { conflict, invalid, isUniqueConstraintError, notFound } from "@/lib/errors";
import { viewingDecisionSchema, viewingRequestSchema, viewingSlotSchema } from "@/lib/validation/interactions";
import { parseOrThrow } from "@/server/services/auth";
import { notifyUser } from "@/server/services/notifications";
import { assertRole, type Actor } from "@/server/services/permissions";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";

export const PROPOSED_VIEWING_MINUTES = 30;
const MIN_LEAD_MS = 60 * 60 * 1000; // viewings must start at least an hour from now
const MAX_AHEAD_MS = 120 * 24 * 60 * 60 * 1000;

async function propertyTimeZone(propertyId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { city: { select: { country: { select: { timeZone: true } } } } },
  });
  return property?.city?.country.timeZone ?? DEFAULT_TIME_ZONE;
}

/**
 * Locks the given users' rows for the rest of the transaction. Every operation that can
 * create a confirmed appointment for a person takes this lock first, so two concurrent
 * accepts for the same owner or tenant run one after the other and see each other's result.
 * Locks are always taken in id order to avoid deadlocks.
 */
async function lockUsers(tx: Tx, userIds: string[]) {
  for (const id of [...new Set(userIds)].sort()) {
    await tx.$queryRaw`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${id} FOR UPDATE`;
  }
}

async function findAcceptedConflict(tx: Tx, userId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  return tx.viewingRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [{ ownerId: userId }, { tenantId: userId }],
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startsAt: true, property: { select: { title: true } } },
  });
}

// ─── Owner: viewing slots ─────────────────────────────────────

export async function createViewingSlot(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER"]);
  const data = parseOrThrow(viewingSlotSchema, input);
  const property = await db.property.findUnique({ where: { id: data.propertyId }, select: { ownerId: true, status: true } });
  if (!property || property.ownerId !== actor.id) throw notFound("Listing not found.");
  if (property.status === "RENTED" || property.status === "UNPUBLISHED") {
    throw conflict("You can only offer viewing times for active listings.");
  }

  const timeZone = await propertyTimeZone(data.propertyId);
  const startsAt = zonedDateTimeToUtc(data.date, data.startTime, timeZone);
  if (!startsAt) throw invalid("Enter a valid date and time.", { startTime: ["Enter a valid time"] });
  const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000);
  const now = Date.now();
  if (startsAt.getTime() < now + MIN_LEAD_MS) throw invalid("Viewing times must be at least one hour in the future.", { date: ["Choose a future date and time"] });
  if (startsAt.getTime() > now + MAX_AHEAD_MS) throw invalid("Viewing times can be at most 120 days ahead.", { date: ["Choose a date within 120 days"] });

  return db.$transaction(async (tx) => {
    await lockUsers(tx, [actor.id]);
    const overlapping = await tx.viewingSlot.findFirst({
      where: { ownerId: actor.id, isCancelled: false, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      select: { startsAt: true, property: { select: { title: true } } },
    });
    if (overlapping) {
      throw conflict(`This overlaps a time you already offered for "${overlapping.property.title}" at ${formatDateTime(overlapping.startsAt, timeZone)}.`);
    }
    return tx.viewingSlot.create({
      data: { propertyId: data.propertyId, ownerId: actor.id, startsAt, endsAt, note: data.note },
      select: { id: true },
    });
  });
}

export async function cancelViewingSlot(actor: Actor, slotId: string) {
  assertRole(actor, ["OWNER"]);
  const slot = await db.viewingSlot.findUnique({ where: { id: slotId }, select: { id: true, ownerId: true, isCancelled: true, property: { select: { title: true } } } });
  if (!slot || slot.ownerId !== actor.id) throw notFound("Viewing time not found.");
  if (slot.isCancelled) return;

  const affected = await db.$transaction(async (tx) => {
    await lockUsers(tx, [actor.id]);
    await tx.viewingSlot.update({ where: { id: slot.id }, data: { isCancelled: true } });
    const requests = await tx.viewingRequest.findMany({
      where: { slotId: slot.id, status: { in: ["PENDING", "ACCEPTED"] } },
      select: { id: true, tenantId: true },
    });
    await tx.viewingRequest.updateMany({
      where: { id: { in: requests.map((r) => r.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.id, ownerNote: "The owner withdrew this viewing time." },
    });
    return requests;
  });

  await Promise.all(
    affected.map((request) =>
      notifyUser({
        userId: request.tenantId,
        type: "VIEWING_CANCELLED",
        title: "Viewing cancelled",
        body: `The owner withdrew the viewing time you requested for "${slot.property.title}".`,
        link: "/dashboard/viewings",
        category: "viewings",
      }),
    ),
  );
}

// ─── Tenant: requesting a viewing ─────────────────────────────

export async function requestViewing(actor: Actor & { name?: string }, input: unknown) {
  assertRole(actor, ["TENANT"], "Sign in with a tenant account to request viewings.");
  const data = parseOrThrow(viewingRequestSchema, input);

  const duplicate = await db.viewingRequest.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true, tenantId: true } });
  if (duplicate && duplicate.tenantId === actor.id) return { viewingId: duplicate.id, duplicate: true };

  const property = await db.property.findUnique({ where: { id: data.propertyId }, select: { id: true, status: true, ownerId: true, title: true } });
  if (!property || property.status !== "PUBLISHED") throw notFound("This listing is no longer available.");
  if (property.ownerId === actor.id) throw conflict("You can't request a viewing of your own listing.");

  await enforceRateLimit(`viewing:${actor.id}`, RATE_LIMITS.viewingRequest, "You've requested a lot of viewings recently. Please wait a while.");

  const timeZone = await propertyTimeZone(property.id);
  let startsAt: Date;
  let endsAt: Date;
  let slotId: string | null = null;

  if (data.slotId) {
    const slot = await db.viewingSlot.findFirst({ where: { id: data.slotId, propertyId: property.id, isCancelled: false } });
    if (!slot) throw invalid("That viewing time is no longer offered.", { slotId: ["That viewing time is no longer offered."] });
    startsAt = slot.startsAt;
    endsAt = slot.endsAt;
    slotId = slot.id;
  } else {
    const proposed = zonedDateTimeToUtc(data.date!, data.time!, timeZone);
    if (!proposed || !parseCalendarDate(data.date!)) throw invalid("Enter a valid date and time.", { date: ["Enter a valid date"] });
    startsAt = proposed;
    endsAt = new Date(proposed.getTime() + PROPOSED_VIEWING_MINUTES * 60_000);
  }

  const now = Date.now();
  if (startsAt.getTime() < now + MIN_LEAD_MS) throw invalid("Choose a time at least one hour from now.", { date: ["Choose a time at least one hour from now"] });
  if (startsAt.getTime() > now + MAX_AHEAD_MS) throw invalid("Choose a time within the next 120 days.", { date: ["Choose a date within 120 days"] });

  let viewingId: string;
  try {
    viewingId = await db.$transaction(async (tx) => {
      await lockUsers(tx, [actor.id]);
      const active = await tx.viewingRequest.findFirst({
        where: { propertyId: property.id, tenantId: actor.id, status: { in: ["PENDING", "ACCEPTED"] }, endsAt: { gt: new Date() } },
        select: { id: true },
      });
      if (active) throw conflict("You already have an active viewing request for this property. Cancel it first to choose another time.");
      if (slotId) {
        const taken = await tx.viewingRequest.findFirst({ where: { slotId, status: "ACCEPTED" }, select: { id: true } });
        if (taken) throw conflict("That viewing time has just been booked by someone else. Please choose another.");
      }
      const clash = await findAcceptedConflict(tx, actor.id, startsAt, endsAt);
      if (clash) throw conflict(`You already have a confirmed viewing at that time for "${clash.property.title}".`);

      const enquiry = await tx.enquiry.findUnique({ where: { propertyId_tenantId: { propertyId: property.id, tenantId: actor.id } }, select: { id: true } });
      const request = await tx.viewingRequest.create({
        data: {
          propertyId: property.id,
          tenantId: actor.id,
          ownerId: property.ownerId,
          slotId,
          enquiryId: enquiry?.id,
          startsAt,
          endsAt,
          tenantNote: data.note,
          idempotencyKey: data.idempotencyKey,
        },
        select: { id: true },
      });
      return request.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await db.viewingRequest.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true, tenantId: true } });
      if (existing && existing.tenantId === actor.id) return { viewingId: existing.id, duplicate: true };
    }
    throw error;
  }

  await notifyUser({
    userId: property.ownerId,
    type: "VIEWING_REQUESTED",
    title: "New viewing request",
    body: `${actor.name ?? "A tenant"} asked to view "${property.title}" on ${formatDateTime(startsAt, timeZone)}.`,
    link: "/dashboard/viewings",
    category: "viewings",
  });
  return { viewingId, duplicate: false };
}

// ─── Owner decisions ──────────────────────────────────────────

async function loadForOwner(actor: Actor, viewingId: string) {
  assertRole(actor, ["OWNER"]);
  const viewing = await db.viewingRequest.findUnique({
    where: { id: viewingId },
    select: { id: true, ownerId: true, tenantId: true, status: true, startsAt: true, endsAt: true, slotId: true, propertyId: true, property: { select: { title: true } } },
  });
  if (!viewing || viewing.ownerId !== actor.id) throw notFound("Viewing request not found.");
  return viewing;
}

/**
 * Accepts a viewing request. Runs in a transaction that locks both participants, re-checks the
 * request is still pending, and refuses if either person already has a confirmed viewing that
 * overlaps — so conflicting confirmed appointments can't be created even under concurrent clicks.
 */
export async function acceptViewing(actor: Actor, input: unknown) {
  const data = parseOrThrow(viewingDecisionSchema, input);
  const viewing = await loadForOwner(actor, data.viewingId);
  const timeZone = await propertyTimeZone(viewing.propertyId);

  const autoDeclined = await db.$transaction(async (tx) => {
    await lockUsers(tx, [viewing.ownerId, viewing.tenantId]);
    const current = await tx.viewingRequest.findUnique({ where: { id: viewing.id }, select: { status: true, startsAt: true } });
    if (!current || current.status !== "PENDING") throw conflict("This request is no longer pending.");
    if (current.startsAt.getTime() <= Date.now()) throw conflict("This viewing time has already passed.");

    const ownerClash = await findAcceptedConflict(tx, viewing.ownerId, viewing.startsAt, viewing.endsAt, viewing.id);
    if (ownerClash) {
      throw conflict(`You already have a confirmed viewing at ${formatDateTime(ownerClash.startsAt, timeZone)} for "${ownerClash.property.title}". Decline this request or cancel the other viewing first.`);
    }
    const tenantClash = await findAcceptedConflict(tx, viewing.tenantId, viewing.startsAt, viewing.endsAt, viewing.id);
    if (tenantClash) throw conflict("The tenant already has another confirmed viewing at this time.");

    await tx.viewingRequest.update({
      where: { id: viewing.id },
      data: { status: "ACCEPTED", decidedAt: new Date(), ownerNote: data.note },
    });

    // Other pending requests for the same slot can no longer be accepted.
    if (!viewing.slotId) return [];
    const others = await tx.viewingRequest.findMany({
      where: { slotId: viewing.slotId, status: "PENDING", id: { not: viewing.id } },
      select: { id: true, tenantId: true },
    });
    await tx.viewingRequest.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { status: "DECLINED", decidedAt: new Date(), ownerNote: "This time was confirmed for another tenant." },
    });
    return others;
  });

  await notifyUser({
    userId: viewing.tenantId,
    type: "VIEWING_ACCEPTED",
    title: "Viewing accepted",
    body: `Your viewing of "${viewing.property.title}" on ${formatDateTime(viewing.startsAt, timeZone)} was accepted. This is a viewing appointment, not a rental agreement.`,
    link: "/dashboard/viewings",
    category: "viewings",
  });
  await Promise.all(
    autoDeclined.map((other) =>
      notifyUser({
        userId: other.tenantId,
        type: "VIEWING_DECLINED",
        title: "Viewing time unavailable",
        body: `The time you requested for "${viewing.property.title}" was confirmed for another tenant. You can request a different time.`,
        link: "/dashboard/viewings",
        category: "viewings",
      }),
    ),
  );
}

export async function declineViewing(actor: Actor, input: unknown) {
  const data = parseOrThrow(viewingDecisionSchema, input);
  const viewing = await loadForOwner(actor, data.viewingId);
  const updated = await db.viewingRequest.updateMany({
    where: { id: viewing.id, status: "PENDING" },
    data: { status: "DECLINED", decidedAt: new Date(), ownerNote: data.note },
  });
  if (updated.count !== 1) throw conflict("This request is no longer pending.");
  await notifyUser({
    userId: viewing.tenantId,
    type: "VIEWING_DECLINED",
    title: "Viewing request declined",
    body: `The owner declined your viewing request for "${viewing.property.title}".${data.note ? ` Note: ${data.note}` : ""}`,
    link: "/dashboard/viewings",
    category: "viewings",
  });
}

/** Either participant can cancel. Tenants can cancel pending or accepted requests; owners can cancel accepted ones. */
export async function cancelViewing(actor: Actor, input: unknown) {
  const data = parseOrThrow(viewingDecisionSchema, input);
  const viewing = await db.viewingRequest.findUnique({
    where: { id: data.viewingId },
    select: { id: true, ownerId: true, tenantId: true, status: true, property: { select: { title: true } } },
  });
  if (!viewing || (viewing.ownerId !== actor.id && viewing.tenantId !== actor.id)) throw notFound("Viewing request not found.");
  const isTenant = viewing.tenantId === actor.id;
  const allowed = isTenant ? ["PENDING", "ACCEPTED"] : ["ACCEPTED"];
  if (!allowed.includes(viewing.status)) throw conflict("This viewing can't be cancelled.");

  const updated = await db.viewingRequest.updateMany({
    where: { id: viewing.id, status: { in: allowed as ("PENDING" | "ACCEPTED")[] } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: actor.id,
      ...(isTenant ? {} : { ownerNote: data.note }),
    },
  });
  if (updated.count !== 1) throw conflict("This viewing was updated elsewhere. Refresh and try again.");

  await notifyUser({
    userId: isTenant ? viewing.ownerId : viewing.tenantId,
    type: "VIEWING_CANCELLED",
    title: "Viewing cancelled",
    body: `The ${isTenant ? "tenant" : "owner"} cancelled the viewing of "${viewing.property.title}".${data.note ? ` Note: ${data.note}` : ""}`,
    link: "/dashboard/viewings",
    category: "viewings",
  });
}
