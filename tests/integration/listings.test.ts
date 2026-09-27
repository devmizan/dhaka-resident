import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseSearchParams } from "@/lib/search-params";
import { changeUserRole, setUserSuspended } from "@/server/services/admin";
import {
  approveListing,
  changeListingStatus,
  createDraftListing,
  getOwnedListing,
  rejectListing,
  saveDetailsStep,
  saveLocationStep,
  savePricingStep,
  setListingFeatured,
  submitListing,
  unpublishListing,
  updateAvailability,
} from "@/server/services/listings";
import { searchListings } from "@/server/queries/listings";
import { createProperty, createReferenceData, createUser, futureDate, resetDatabase, type Refs } from "./helpers";

let refs: Refs;

beforeEach(async () => {
  await resetDatabase();
  refs = await createReferenceData();
});
afterAll(() => db.$disconnect());

async function completeDraft(owner: { id: string; role: "OWNER" }) {
  const id = await createDraftListing(owner, { categoryId: refs.apartment.id });
  await saveLocationStep(owner, id, { cityId: refs.dhaka.id, neighborhoodId: refs.gulshan.id, addressVisibility: "PRIVATE" });
  await saveDetailsStep(owner, id, {
    title: "Sunny 2-bed apartment in Gulshan",
    description: "Bright, airy apartment close to Gulshan 2 Circle with a lift and a generator for power cuts.",
    bedrooms: "2",
    availableFrom: futureDate(10),
    tenantPreference: "ANY",
  });
  await savePricingStep(owner, id, { rentAmount: "45000", billingPeriod: "MONTHLY" });
  return id;
}

describe("owner listing workflow and approval", () => {
  it("runs draft → submit → approve → visible in search", async () => {
    const owner = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const admin = await createUser("ADMIN");
    const id = await completeDraft(owner);

    // Photos are missing, so submission is refused with a clear message.
    await expect(submitListing(owner, id)).rejects.toThrow(/photos/);
    await db.propertyPhoto.createMany({ data: [0, 1, 2].map((i) => ({ propertyId: id, url: `/demo-photos/living-${i + 1}.webp`, sortOrder: i })) });

    await submitListing(owner, id);
    expect((await db.property.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING_REVIEW");
    expect(await db.notification.count({ where: { userId: admin.id, type: "LISTING_SUBMITTED" } })).toBe(1);

    let results = await searchListings(parseSearchParams({ city: "dhaka" }));
    expect(results.items.map((i) => i.id)).not.toContain(id);

    await approveListing(admin, id);
    const approved = await db.property.findUniqueOrThrow({ where: { id } });
    expect(approved.status).toBe("PUBLISHED");
    expect(approved.slug).toMatch(/^sunny-2-bed-apartment-in-gulshan-/);
    expect(await db.adminActivity.count({ where: { entityId: id, action: "listing.approve" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: owner.id, type: "LISTING_APPROVED" } })).toBe(1);

    results = await searchListings(parseSearchParams({ city: "dhaka" }));
    expect(results.items.map((i) => i.id)).toContain(id);
  });

  it("requires a reason to reject and lets the owner resubmit", async () => {
    const owner = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const admin = await createUser("ADMIN");
    const property = await createProperty(owner.id, refs, { status: "PENDING_REVIEW" });

    await expect(rejectListing(admin, { propertyId: property.id, reason: "no" })).rejects.toMatchObject({ code: "VALIDATION" });
    await rejectListing(admin, { propertyId: property.id, reason: "Please add real photos of the bedrooms." });
    const rejected = await db.property.findUniqueOrThrow({ where: { id: property.id } });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toContain("real photos");

    await submitListing(owner, property.id);
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).status).toBe("PENDING_REVIEW");
  });

  it("sends content edits of a published listing back to review, but not availability updates", async () => {
    const owner = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const property = await createProperty(owner.id, refs);

    await updateAvailability(owner, property.id, { availableFrom: futureDate(5) });
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).status).toBe("PUBLISHED");

    await savePricingStep(owner, property.id, { rentAmount: "99000", billingPeriod: "MONTHLY" });
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).status).toBe("PENDING_REVIEW");
  });

  it("handles pause, rented and relist", async () => {
    const owner = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const property = await createProperty(owner.id, refs);
    expect(await changeListingStatus(owner, property.id, "pause")).toBe("PAUSED");
    expect(await changeListingStatus(owner, property.id, "markRented")).toBe("RENTED");
    await expect(changeListingStatus(owner, property.id, "pause")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await changeListingStatus(owner, property.id, "relist")).toBe("PUBLISHED");
  });

  it("only features published listings and only admins can moderate", async () => {
    const owner = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const admin = await createUser("ADMIN");
    const draft = await createProperty(owner.id, refs, { status: "DRAFT" });
    const live = await createProperty(owner.id, refs);

    await expect(setListingFeatured(admin, draft.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    await setListingFeatured(admin, live.id, true);
    await expect(setListingFeatured(owner, live.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(approveListing(owner, draft.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(unpublishListing(owner, { propertyId: live.id, reason: "I am not an admin at all" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ownership and role permissions", () => {
  it("prevents owners from touching other owners' listings", async () => {
    const alice = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const bob = (await createUser("OWNER")) as { id: string; role: "OWNER" };
    const property = await createProperty(alice.id, refs);

    await expect(getOwnedListing(bob, property.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(savePricingStep(bob, property.id, { rentAmount: "1000", billingPeriod: "MONTHLY" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeListingStatus(bob, property.id, "pause")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).rentAmount).toBe(30000);
  });

  it("prevents tenants and admins from creating listings", async () => {
    const tenant = await createUser("TENANT");
    const admin = await createUser("ADMIN");
    await expect(createDraftListing(tenant, { categoryId: refs.apartment.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createDraftListing(admin, { categoryId: refs.apartment.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("protects role management", async () => {
    const admin = await createUser("ADMIN");
    const owner = await createUser("OWNER");
    const tenant = await createUser("TENANT");

    await expect(changeUserRole(owner, { userId: tenant.id, role: "ADMIN" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeUserRole(admin, { userId: admin.id, role: "TENANT" })).rejects.toMatchObject({ code: "CONFLICT" });

    await changeUserRole(admin, { userId: tenant.id, role: "OWNER" });
    expect((await db.user.findUniqueOrThrow({ where: { id: tenant.id } })).role).toBe("OWNER");
    expect(await db.adminActivity.count({ where: { action: "user.role_changed", entityId: tenant.id } })).toBe(1);

    await expect(setUserSuspended(admin, admin.id, true)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("hides a suspended owner's live listings", async () => {
    const admin = await createUser("ADMIN");
    const owner = await createUser("OWNER");
    const property = await createProperty(owner.id, refs);
    await setUserSuspended(admin, owner.id, true);
    expect((await db.property.findUniqueOrThrow({ where: { id: property.id } })).status).toBe("PAUSED");
  });
});
