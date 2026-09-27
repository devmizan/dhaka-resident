import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { zonedDateTimeToUtc } from "@/lib/dates";
import { getConversation } from "@/server/queries/dashboard";
import { createEnquiry, getEnquiryForParticipant, sendMessage, setEnquiryStatus } from "@/server/services/enquiries";
import { reportListing, setFavorite } from "@/server/services/tenant";
import { acceptViewing, cancelViewing, cancelViewingSlot, createViewingSlot, declineViewing, requestViewing } from "@/server/services/viewings";
import { createProperty, createReferenceData, createUser, futureDate, key, resetDatabase, type Refs } from "./helpers";

let refs: Refs;

beforeEach(async () => {
  await resetDatabase();
  refs = await createReferenceData();
});
afterAll(() => db.$disconnect());

describe("enquiries and private messages", () => {
  it("creates one conversation, ignores duplicate submissions, and restricts access to participants", async () => {
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const stranger = await createUser("TENANT");
    const otherOwner = await createUser("OWNER");
    const property = await createProperty(owner.id, refs);

    const idempotencyKey = key();
    const input = { propertyId: property.id, message: "Is the flat still available next month?", idempotencyKey };
    const first = await createEnquiry(tenant, input);
    const replay = await createEnquiry(tenant, input);
    expect(replay).toEqual({ enquiryId: first.enquiryId, duplicate: true });
    expect(await db.message.count()).toBe(1);

    // A second enquiry about the same property continues the same thread.
    const second = await createEnquiry(tenant, { ...input, message: "Also, is parking included?", idempotencyKey: key() });
    expect(second.enquiryId).toBe(first.enquiryId);
    expect(await db.enquiry.count()).toBe(1);

    await sendMessage(owner, { enquiryId: first.enquiryId, body: "Yes, one parking space.", idempotencyKey: key() });
    expect(await db.notification.count({ where: { userId: tenant.id, type: "MESSAGE_RECEIVED" } })).toBe(1);

    for (const outsider of [stranger, otherOwner]) {
      await expect(getEnquiryForParticipant(outsider, first.enquiryId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(sendMessage(outsider, { enquiryId: first.enquiryId, body: "sneaky", idempotencyKey: key() })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await getConversation({ ...outsider, status: "ACTIVE", phone: null, isDemo: false } as never, first.enquiryId)).toBeNull();
    }
    expect(await getConversation({ ...tenant, status: "ACTIVE", phone: null, isDemo: false } as never, first.enquiryId)).not.toBeNull();
  });

  it("only allows tenants to enquire, and only on published listings they don't own", async () => {
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const live = await createProperty(owner.id, refs);
    const draft = await createProperty(owner.id, refs, { status: "DRAFT" });

    await expect(createEnquiry(owner, { propertyId: live.id, message: "Messaging my own listing", idempotencyKey: key() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createEnquiry(tenant, { propertyId: draft.id, message: "Is this draft available?", idempotencyKey: key() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stops tenant replies when the owner closes the conversation", async () => {
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const property = await createProperty(owner.id, refs);
    const { enquiryId } = await createEnquiry(tenant, { propertyId: property.id, message: "Hello, still available?", idempotencyKey: key() });

    await expect(setEnquiryStatus(tenant, enquiryId, "CLOSED")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await setEnquiryStatus(owner, enquiryId, "CLOSED");
    await expect(sendMessage(tenant, { enquiryId, body: "Hello?", idempotencyKey: key() })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("saves favourites and accepts one open report per user per listing", async () => {
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const property = await createProperty(owner.id, refs);
    await setFavorite(tenant, property.id, true);
    await setFavorite(tenant, property.id, true);
    expect(await db.favorite.count()).toBe(1);
    await expect(setFavorite(owner, property.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await reportListing(tenant, { propertyId: property.id, reason: "INACCURATE_INFORMATION", details: "Photos don't match the flat." });
    await expect(reportListing(tenant, { propertyId: property.id, reason: "OTHER", details: "Reporting it a second time." })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reportListing(owner, { propertyId: property.id, reason: "OTHER", details: "Reporting my own listing." })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("viewing requests and conflicts", () => {
  const slotInput = (propertyId: string, days: number, time: string, durationMinutes = 30) => ({ propertyId, date: futureDate(days), startTime: time, durationMinutes: String(durationMinutes) });

  it("lets tenants request an offered slot and owners accept it; other requests for the slot are declined", async () => {
    const owner = await createUser("OWNER");
    const t1 = await createUser("TENANT");
    const t2 = await createUser("TENANT");
    const property = await createProperty(owner.id, refs);
    const slot = await createViewingSlot(owner, slotInput(property.id, 3, "11:00"));

    const r1 = await requestViewing(t1, { propertyId: property.id, slotId: slot.id, idempotencyKey: key() });
    const r2 = await requestViewing(t2, { propertyId: property.id, slotId: slot.id, idempotencyKey: key() });

    const stored = await db.viewingRequest.findUniqueOrThrow({ where: { id: r1.viewingId } });
    expect(stored.startsAt.toISOString()).toBe(zonedDateTimeToUtc(futureDate(3), "11:00", "Asia/Dhaka")!.toISOString());

    await acceptViewing(owner, { viewingId: r1.viewingId });
    expect((await db.viewingRequest.findUniqueOrThrow({ where: { id: r1.viewingId } })).status).toBe("ACCEPTED");
    expect((await db.viewingRequest.findUniqueOrThrow({ where: { id: r2.viewingId } })).status).toBe("DECLINED");
    expect(await db.notification.count({ where: { userId: t1.id, type: "VIEWING_ACCEPTED" } })).toBe(1);

    // The slot is taken, so a new request for it is refused.
    const t3 = await createUser("TENANT");
    await expect(requestViewing(t3, { propertyId: property.id, slotId: slot.id, idempotencyKey: key() })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to accept a viewing that overlaps an existing confirmed appointment", async () => {
    const owner = await createUser("OWNER");
    const t1 = await createUser("TENANT");
    const t2 = await createUser("TENANT");
    const flatA = await createProperty(owner.id, refs);
    const flatB = await createProperty(owner.id, refs);

    const a = await requestViewing(t1, { propertyId: flatA.id, date: futureDate(4), time: "15:00", idempotencyKey: key() });
    const b = await requestViewing(t2, { propertyId: flatB.id, date: futureDate(4), time: "15:15", idempotencyKey: key() });

    await acceptViewing(owner, { viewingId: a.viewingId });
    await expect(acceptViewing(owner, { viewingId: b.viewingId })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.viewingRequest.count({ where: { ownerId: owner.id, status: "ACCEPTED" } })).toBe(1);

    // After cancelling the first, the second can be accepted.
    await cancelViewing(t1, { viewingId: a.viewingId });
    await acceptViewing(owner, { viewingId: b.viewingId });
    expect((await db.viewingRequest.findUniqueOrThrow({ where: { id: b.viewingId } })).status).toBe("ACCEPTED");
  });

  it("never confirms two overlapping appointments under concurrent accepts", async () => {
    const owner = await createUser("OWNER");
    const tenants = await Promise.all(Array.from({ length: 5 }, () => createUser("TENANT")));
    const properties = await Promise.all(tenants.map(() => createProperty(owner.id, refs)));
    const requests = await Promise.all(
      tenants.map((tenant, i) => requestViewing(tenant, { propertyId: properties[i]!.id, date: futureDate(6), time: "10:00", idempotencyKey: key() })),
    );

    const outcomes = await Promise.allSettled(requests.map((r) => acceptViewing(owner, { viewingId: r.viewingId })));
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await db.viewingRequest.count({ where: { ownerId: owner.id, status: "ACCEPTED" } })).toBe(1);
  });

  it("prevents a tenant from being confirmed for two overlapping viewings", async () => {
    const ownerA = await createUser("OWNER");
    const ownerB = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const flatA = await createProperty(ownerA.id, refs);
    const flatB = await createProperty(ownerB.id, refs);

    const a = await requestViewing(tenant, { propertyId: flatA.id, date: futureDate(7), time: "12:00", idempotencyKey: key() });
    const b = await requestViewing(tenant, { propertyId: flatB.id, date: futureDate(7), time: "12:10", idempotencyKey: key() });
    await acceptViewing(ownerA, { viewingId: a.viewingId });
    await expect(acceptViewing(ownerB, { viewingId: b.viewingId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("blocks overlapping slots, duplicate requests, past times and other owners' decisions", async () => {
    const owner = await createUser("OWNER");
    const intruder = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const property = await createProperty(owner.id, refs);

    await createViewingSlot(owner, slotInput(property.id, 2, "16:00", 60));
    await expect(createViewingSlot(owner, slotInput(property.id, 2, "16:30"))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createViewingSlot(intruder, slotInput(property.id, 2, "18:00"))).rejects.toMatchObject({ code: "NOT_FOUND" });

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await expect(requestViewing(tenant, { propertyId: property.id, date: yesterday, time: "10:00", idempotencyKey: key() })).rejects.toMatchObject({ code: "VALIDATION" });

    const idempotencyKey = key();
    const first = await requestViewing(tenant, { propertyId: property.id, date: futureDate(3), time: "09:00", idempotencyKey });
    expect(await requestViewing(tenant, { propertyId: property.id, date: futureDate(3), time: "09:00", idempotencyKey })).toEqual({ viewingId: first.viewingId, duplicate: true });
    await expect(requestViewing(tenant, { propertyId: property.id, date: futureDate(5), time: "09:00", idempotencyKey: key() })).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(acceptViewing(intruder, { viewingId: first.viewingId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(acceptViewing(tenant, { viewingId: first.viewingId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await declineViewing(owner, { viewingId: first.viewingId, note: "Not available that morning." });
    await expect(acceptViewing(owner, { viewingId: first.viewingId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cancels affected requests when the owner withdraws a slot", async () => {
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");
    const property = await createProperty(owner.id, refs);
    const slot = await createViewingSlot(owner, slotInput(property.id, 3, "13:00"));
    const request = await requestViewing(tenant, { propertyId: property.id, slotId: slot.id, idempotencyKey: key() });

    await cancelViewingSlot(owner, slot.id);
    expect((await db.viewingRequest.findUniqueOrThrow({ where: { id: request.viewingId } })).status).toBe("CANCELLED");
    expect(await db.notification.count({ where: { userId: tenant.id, type: "VIEWING_CANCELLED" } })).toBe(1);
  });
});
