import { db } from "@/lib/db";
import { parseCalendarDate } from "@/lib/dates";
import { conflict, isUniqueConstraintError, notFound } from "@/lib/errors";
import { enquirySchema, messageSchema } from "@/lib/validation/interactions";
import { parseOrThrow } from "@/server/services/auth";
import { notifyUser } from "@/server/services/notifications";
import { assertRole, type Actor } from "@/server/services/permissions";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";

/**
 * Starts (or continues) the conversation between a tenant and the owner of a published listing.
 * Replaying the same idempotency key returns the original enquiry instead of duplicating it.
 */
export async function createEnquiry(actor: Actor, input: unknown) {
  assertRole(actor, ["TENANT"], "Sign in with a tenant account to send enquiries.");
  const data = parseOrThrow(enquirySchema, input);

  const duplicate = await db.message.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { enquiryId: true, senderId: true } });
  if (duplicate && duplicate.senderId === actor.id) return { enquiryId: duplicate.enquiryId, duplicate: true };

  const property = await db.property.findUnique({ where: { id: data.propertyId }, select: { id: true, status: true, ownerId: true, title: true } });
  if (!property || property.status !== "PUBLISHED") throw notFound("This listing is no longer available.");
  if (property.ownerId === actor.id) throw conflict("You can't send an enquiry to your own listing.");

  await enforceRateLimit(`enquiry:${actor.id}`, RATE_LIMITS.enquiry, "You've sent a lot of enquiries recently. Please wait a while before sending more.");

  let enquiryId: string;
  try {
    enquiryId = await db.$transaction(async (tx) => {
      const now = new Date();
      const enquiry = await tx.enquiry.upsert({
        where: { propertyId_tenantId: { propertyId: property.id, tenantId: actor.id } },
        create: {
          propertyId: property.id,
          tenantId: actor.id,
          ownerId: property.ownerId,
          moveInDate: parseCalendarDate(data.moveInDate),
          occupants: data.occupants,
          lastMessageAt: now,
          tenantLastReadAt: now,
        },
        update: {
          status: "OPEN",
          lastMessageAt: now,
          tenantLastReadAt: now,
          ...(data.moveInDate ? { moveInDate: parseCalendarDate(data.moveInDate) } : {}),
          ...(data.occupants ? { occupants: data.occupants } : {}),
        },
        select: { id: true },
      });
      await tx.message.create({
        data: { enquiryId: enquiry.id, senderId: actor.id, body: data.message, idempotencyKey: data.idempotencyKey },
      });
      return enquiry.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await db.message.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { enquiryId: true, senderId: true } });
      if (existing && existing.senderId === actor.id) return { enquiryId: existing.enquiryId, duplicate: true };
    }
    throw error;
  }

  await notifyUser({
    userId: property.ownerId,
    type: "ENQUIRY_RECEIVED",
    title: "New enquiry",
    body: `${actor.name ?? "A tenant"} sent an enquiry about "${property.title}".`,
    link: `/dashboard/messages/${enquiryId}`,
    category: "enquiries",
  });
  return { enquiryId, duplicate: false };
}

/** Loads a conversation only for its two participants. */
export async function getEnquiryForParticipant(actor: Actor, enquiryId: string) {
  const enquiry = await db.enquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, tenantId: true, ownerId: true, status: true, property: { select: { title: true } } },
  });
  if (!enquiry || (enquiry.tenantId !== actor.id && enquiry.ownerId !== actor.id)) {
    throw notFound("Conversation not found.");
  }
  return enquiry;
}

export async function sendMessage(actor: Actor & { name?: string }, input: unknown) {
  const data = parseOrThrow(messageSchema, input);
  const enquiry = await getEnquiryForParticipant(actor, data.enquiryId);

  const duplicate = await db.message.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true, senderId: true } });
  if (duplicate && duplicate.senderId === actor.id) return { messageId: duplicate.id, duplicate: true };

  await enforceRateLimit(`message:${actor.id}`, RATE_LIMITS.message, "You're sending messages too quickly. Please wait a little.");
  const isTenant = enquiry.tenantId === actor.id;
  if (isTenant && enquiry.status === "CLOSED") {
    throw conflict("The owner closed this conversation. Send a new enquiry from the listing if you're still interested.");
  }

  let messageId: string;
  try {
    messageId = await db.$transaction(async (tx) => {
      const now = new Date();
      const message = await tx.message.create({
        data: { enquiryId: enquiry.id, senderId: actor.id, body: data.body, idempotencyKey: data.idempotencyKey },
        select: { id: true },
      });
      await tx.enquiry.update({
        where: { id: enquiry.id },
        data: { lastMessageAt: now, ...(isTenant ? { tenantLastReadAt: now } : { ownerLastReadAt: now }) },
      });
      return message.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await db.message.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true, senderId: true } });
      if (existing && existing.senderId === actor.id) return { messageId: existing.id, duplicate: true };
    }
    throw error;
  }

  await notifyUser({
    userId: isTenant ? enquiry.ownerId : enquiry.tenantId,
    type: "MESSAGE_RECEIVED",
    title: "New message",
    body: `${actor.name ?? "Someone"} replied about "${enquiry.property.title}".`,
    link: `/dashboard/messages/${enquiry.id}`,
    category: "enquiries",
  });
  return { messageId, duplicate: false };
}

export async function markEnquiryRead(actor: Actor, enquiryId: string) {
  const enquiry = await getEnquiryForParticipant(actor, enquiryId);
  const now = new Date();
  await db.enquiry.update({
    where: { id: enquiry.id },
    data: enquiry.tenantId === actor.id ? { tenantLastReadAt: now } : { ownerLastReadAt: now },
  });
}

export async function setEnquiryStatus(actor: Actor, enquiryId: string, status: "OPEN" | "CLOSED") {
  const enquiry = await getEnquiryForParticipant(actor, enquiryId);
  if (enquiry.ownerId !== actor.id) throw notFound("Conversation not found.");
  await db.enquiry.update({ where: { id: enquiry.id }, data: { status } });
}
