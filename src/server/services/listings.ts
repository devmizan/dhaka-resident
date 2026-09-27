import { randomBytes } from "node:crypto";
import type { ListingStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db";
import { parseCalendarDate } from "@/lib/dates";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { listingCompleteness } from "@/lib/listing-completeness";
import { canTransition, LISTING_TRANSITIONS, statusAfterContentEdit, type ListingAction } from "@/lib/listing-status";
import { slugify } from "@/lib/utils";
import {
  amenitiesStepSchema,
  availabilitySchema,
  detailsStepSchema,
  locationStepSchema,
  pricingStepSchema,
  typeStepSchema,
} from "@/lib/validation/listing";
import { listingReasonSchema } from "@/lib/validation/admin";
import { logActivity } from "@/server/services/activity";
import { parseOrThrow } from "@/server/services/auth";
import { notifyAdmins, notifyUser } from "@/server/services/notifications";
import { assertRole, type Actor } from "@/server/services/permissions";
import { deleteStoredFile } from "@/server/services/uploads";

const MAX_DRAFTS = 25;

/** Loads a listing only if the actor owns it. Missing and foreign listings look identical. */
export async function getOwnedListing(actor: Actor, propertyId: string) {
  assertRole(actor, ["OWNER"]);
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      title: true,
      slug: true,
      publishedAt: true,
      categoryId: true,
      category: { select: { usesRoomTypes: true } },
    },
  });
  if (!property || property.ownerId !== actor.id) throw notFound("Listing not found.");
  return property;
}

function uniqueSlug(title: string, propertyId: string) {
  const base = slugify(title) || "property";
  return `${base}-${propertyId.slice(-6)}`;
}

/** Moves approved listings back to review after a content change, and notifies admins once. */
async function applyContentEdit(tx: Tx, property: { id: string; status: ListingStatus }) {
  const next = statusAfterContentEdit(property.status);
  if (next !== property.status) {
    await tx.property.update({ where: { id: property.id }, data: { status: next, submittedAt: new Date() } });
    return true;
  }
  return false;
}

async function afterContentEdit(requeued: boolean, title: string) {
  if (requeued) {
    await notifyAdmins({
      type: "LISTING_SUBMITTED",
      title: "Edited listing needs review",
      body: `"${title}" was edited after approval and is waiting for review.`,
      link: "/admin/listings?status=PENDING_REVIEW",
      category: "listing",
    });
  }
}

export async function createDraftListing(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER"], "Only owner accounts can publish listings.");
  const { categoryId } = parseOrThrow(typeStepSchema, input);
  const category = await db.propertyCategory.findFirst({ where: { id: categoryId, isActive: true } });
  if (!category) throw invalid("Choose a valid property type.", { categoryId: ["Choose a valid property type."] });

  // Double-submit protection: reuse a blank draft of the same type created moments ago.
  const recentBlank = await db.property.findFirst({
    where: { ownerId: actor.id, status: "DRAFT", categoryId, title: "", cityId: null, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
  });
  if (recentBlank) return recentBlank.id;

  const drafts = await db.property.count({ where: { ownerId: actor.id, status: "DRAFT" } });
  if (drafts >= MAX_DRAFTS) throw conflict("You have too many drafts. Finish or delete some before starting another listing.");

  const property = await db.property.create({
    data: { ownerId: actor.id, categoryId, status: "DRAFT", slug: `draft-${randomBytes(8).toString("hex")}` },
    select: { id: true },
  });
  return property.id;
}

export async function saveTypeStep(actor: Actor, propertyId: string, input: unknown) {
  const property = await getOwnedListing(actor, propertyId);
  const { categoryId } = parseOrThrow(typeStepSchema, input);
  if (categoryId === property.categoryId) return;
  const category = await db.propertyCategory.findFirst({ where: { id: categoryId, isActive: true } });
  if (!category) throw invalid("Choose a valid property type.", { categoryId: ["Choose a valid property type."] });

  const requeued = await db.$transaction(async (tx) => {
    await tx.property.update({ where: { id: propertyId }, data: { categoryId } });
    if (!category.usesRoomTypes) {
      await tx.roomType.deleteMany({ where: { propertyId } });
    }
    return applyContentEdit(tx, property);
  });
  await afterContentEdit(requeued, property.title);
}

export async function saveLocationStep(actor: Actor, propertyId: string, input: unknown) {
  const property = await getOwnedListing(actor, propertyId);
  const data = parseOrThrow(locationStepSchema, input);
  const city = await db.city.findFirst({ where: { id: data.cityId, isActive: true, country: { isActive: true } }, include: { country: true } });
  if (!city) throw invalid("Choose a valid city.", { cityId: ["Choose a valid city."] });
  if (data.neighborhoodId) {
    const area = await db.neighborhood.findFirst({ where: { id: data.neighborhoodId, cityId: city.id, isActive: true } });
    if (!area) throw invalid("Choose an area within the selected city.", { neighborhoodId: ["Choose an area within the selected city."] });
  }
  if ((data.latitude === undefined) !== (data.longitude === undefined)) {
    throw invalid("Enter both latitude and longitude, or leave both empty.", { longitude: ["Enter both latitude and longitude, or leave both empty."] });
  }

  const requeued = await db.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        cityId: city.id,
        neighborhoodId: data.neighborhoodId ?? null,
        approximateArea: data.approximateArea ?? null,
        addressLine: data.addressLine ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        addressVisibility: data.addressVisibility,
        currencyCode: city.country.currencyCode,
      },
    });
    return applyContentEdit(tx, property);
  });
  await afterContentEdit(requeued, property.title);
}

export async function saveDetailsStep(actor: Actor, propertyId: string, input: unknown) {
  const property = await getOwnedListing(actor, propertyId);
  const data = parseOrThrow(detailsStepSchema, input);
  const usesRoomTypes = property.category.usesRoomTypes;
  const rooms = usesRoomTypes ? (data.roomTypes ?? []) : [];
  if (usesRoomTypes && rooms.length === 0) {
    throw invalid("Add at least one room type.", { roomTypes: ["Add at least one room type with beds and prices."] });
  }

  const requeued = await db.$transaction(async (tx) => {
    const cheapest = rooms.length ? rooms.reduce((min, room) => (room.pricePerBed < min.pricePerBed ? room : min)) : null;
    await tx.property.update({
      where: { id: propertyId },
      data: {
        title: data.title,
        description: data.description,
        // Keep URLs stable once a listing has been published.
        slug: property.publishedAt ? property.slug : uniqueSlug(data.title, propertyId),
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        floorAreaSqft: data.floorAreaSqft ?? null,
        floorNumber: data.floorNumber ?? null,
        totalFloors: data.totalFloors ?? null,
        furnishing: data.furnishing ?? null,
        bathroomType: data.bathroomType ?? null,
        availableFrom: parseCalendarDate(data.availableFrom),
        minimumStay: data.minimumStay ?? null,
        tenantPreference: data.tenantPreference,
        includedFacilities: data.includedFacilities ?? null,
        ...(cheapest ? { rentAmount: cheapest.pricePerBed, billingPeriod: cheapest.billingPeriod } : {}),
      },
    });

    if (usesRoomTypes) {
      const existing = await tx.roomType.findMany({ where: { propertyId }, select: { id: true } });
      const existingIds = new Set(existing.map((r) => r.id));
      const keepIds = rooms.map((r) => r.id).filter((id): id is string => Boolean(id && existingIds.has(id)));
      await tx.roomType.deleteMany({ where: { propertyId, id: { notIn: keepIds } } });
      for (const [index, room] of rooms.entries()) {
        const values = {
          name: room.name,
          bedsPerRoom: room.bedsPerRoom,
          totalBeds: room.totalBeds,
          availableBeds: room.availableBeds,
          pricePerBed: room.pricePerBed,
          billingPeriod: room.billingPeriod,
          bathroomType: room.bathroomType,
          description: room.description ?? null,
          sortOrder: index,
        };
        if (room.id && existingIds.has(room.id)) {
          await tx.roomType.update({ where: { id: room.id }, data: values });
        } else {
          await tx.roomType.create({ data: { ...values, propertyId } });
        }
      }
    }
    return applyContentEdit(tx, property);
  });
  await afterContentEdit(requeued, data.title);
}

export async function savePricingStep(actor: Actor, propertyId: string, input: unknown) {
  const property = await getOwnedListing(actor, propertyId);
  const data = parseOrThrow(pricingStepSchema, input);
  const usesRoomTypes = property.category.usesRoomTypes;
  if (!usesRoomTypes && data.rentAmount === undefined) {
    throw invalid("Enter the rent.", { rentAmount: ["Enter the rent."] });
  }

  const requeued = await db.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        ...(usesRoomTypes ? {} : { rentAmount: data.rentAmount, billingPeriod: data.billingPeriod }),
        rentNegotiable: data.rentNegotiable,
        securityDeposit: data.securityDeposit ?? null,
        advanceRentMonths: data.advanceRentMonths ?? null,
        serviceCharge: data.serviceCharge ?? null,
        utilitiesIncluded: data.utilitiesIncluded,
        utilitiesNote: data.utilitiesNote ?? null,
        otherFees: data.otherFees ?? null,
      },
    });
    return applyContentEdit(tx, property);
  });
  await afterContentEdit(requeued, property.title);
}

export async function saveAmenitiesStep(actor: Actor, propertyId: string, input: unknown) {
  const property = await getOwnedListing(actor, propertyId);
  const data = parseOrThrow(amenitiesStepSchema, input);
  const uniqueIds = [...new Set(data.amenityIds)];
  const valid = await db.amenity.findMany({ where: { id: { in: uniqueIds }, isActive: true }, select: { id: true } });
  if (valid.length !== uniqueIds.length) throw invalid("Some selected amenities are no longer available. Refresh and try again.");

  const requeued = await db.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: { petPolicy: data.petPolicy, smokingAllowed: data.smokingAllowed, houseRules: data.houseRules ?? null },
    });
    await tx.propertyAmenity.deleteMany({ where: { propertyId } });
    if (uniqueIds.length) {
      await tx.propertyAmenity.createMany({ data: uniqueIds.map((amenityId) => ({ propertyId, amenityId })) });
    }
    return applyContentEdit(tx, property);
  });
  await afterContentEdit(requeued, property.title);
}

/** Called after photo uploads, removals and reordering. */
export async function markPhotosChanged(actor: Actor, propertyId: string) {
  const property = await getOwnedListing(actor, propertyId);
  const requeued = await db.$transaction((tx) => applyContentEdit(tx, property));
  await afterContentEdit(requeued, property.title);
}

export async function reorderPhotos(actor: Actor, propertyId: string, photoIds: string[]) {
  await getOwnedListing(actor, propertyId);
  const photos = await db.propertyPhoto.findMany({ where: { propertyId }, select: { id: true } });
  const known = new Set(photos.map((p) => p.id));
  if (photoIds.length !== photos.length || !photoIds.every((id) => known.has(id)) || new Set(photoIds).size !== photoIds.length) {
    throw invalid("The photo list has changed. Refresh the page and try again.");
  }
  await db.$transaction(photoIds.map((id, index) => db.propertyPhoto.update({ where: { id }, data: { sortOrder: index } })));
  await markPhotosChanged(actor, propertyId);
}

export async function removePhoto(actor: Actor, propertyId: string, photoId: string) {
  await getOwnedListing(actor, propertyId);
  const photo = await db.propertyPhoto.findFirst({ where: { id: photoId, propertyId } });
  if (!photo) throw notFound("Photo not found.");
  await db.propertyPhoto.delete({ where: { id: photo.id } });
  if (photo.storageKey) await deleteStoredFile(photo.storageKey);
  await markPhotosChanged(actor, propertyId);
}

export async function getSubmissionChecklist(propertyId: string) {
  const property = await db.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: {
      cityId: true,
      title: true,
      description: true,
      availableFrom: true,
      rentAmount: true,
      category: { select: { usesRoomTypes: true } },
      _count: { select: { photos: true, roomTypes: true } },
    },
  });
  return listingCompleteness({
    cityId: property.cityId,
    title: property.title,
    description: property.description,
    availableFrom: property.availableFrom,
    rentAmount: property.rentAmount,
    usesRoomTypes: property.category.usesRoomTypes,
    roomTypeCount: property._count.roomTypes,
    photoCount: property._count.photos,
  });
}

export async function submitListing(actor: Actor, propertyId: string) {
  const property = await getOwnedListing(actor, propertyId);
  if (!canTransition("submit", property.status, actor.role)) {
    throw conflict("This listing can't be submitted in its current state.");
  }
  const missing = await getSubmissionChecklist(propertyId);
  if (missing.length) throw invalid(`Before submitting: ${missing.map((m) => m.message.toLowerCase()).join("; ")}.`);

  const updated = await db.property.updateMany({
    where: { id: propertyId, ownerId: actor.id, status: { in: LISTING_TRANSITIONS.submit.from } },
    data: { status: "PENDING_REVIEW", submittedAt: new Date(), rejectionReason: null },
  });
  if (updated.count !== 1) throw conflict("This listing was changed elsewhere. Refresh and try again.");

  await notifyAdmins({
    type: "LISTING_SUBMITTED",
    title: "New listing waiting for approval",
    body: `"${property.title}" was submitted for review.`,
    link: "/admin/listings?status=PENDING_REVIEW",
    category: "listing",
  });
}

const OWNER_ACTIONS = ["withdraw", "pause", "resume", "markRented", "relist"] as const;
export type OwnerListingAction = (typeof OWNER_ACTIONS)[number];

export async function changeListingStatus(actor: Actor, propertyId: string, action: OwnerListingAction) {
  if (!OWNER_ACTIONS.includes(action)) throw forbidden();
  const property = await getOwnedListing(actor, propertyId);
  if (!canTransition(action, property.status, actor.role)) {
    throw conflict("That action isn't available for this listing right now.");
  }
  if ((action === "resume" || action === "relist") && !property.publishedAt) {
    throw conflict("This listing needs to be approved before it can be published.");
  }
  const transition = LISTING_TRANSITIONS[action];
  const updated = await db.property.updateMany({
    where: { id: propertyId, ownerId: actor.id, status: { in: transition.from } },
    data: {
      status: transition.to,
      ...(action === "markRented" ? { rentedAt: new Date(), isFeatured: false } : {}),
      ...(action === "relist" ? { rentedAt: null } : {}),
    },
  });
  if (updated.count !== 1) throw conflict("This listing was changed elsewhere. Refresh and try again.");
  return transition.to;
}

export async function deleteListing(actor: Actor, propertyId: string) {
  const property = await getOwnedListing(actor, propertyId);
  if (property.status !== "DRAFT" && property.status !== "REJECTED") {
    throw conflict("Only drafts and listings with requested changes can be deleted. Pause it or mark it as rented instead.");
  }
  const enquiries = await db.enquiry.count({ where: { propertyId } });
  if (enquiries > 0) throw conflict("This listing has tenant conversations, so it can't be deleted.");
  const photos = await db.propertyPhoto.findMany({ where: { propertyId, storageKey: { not: null } }, select: { storageKey: true } });
  await db.property.delete({ where: { id: propertyId } });
  await Promise.all(photos.map((p) => deleteStoredFile(p.storageKey!)));
}

/** Availability updates don't change listing content, so they never require re-approval. */
export async function updateAvailability(actor: Actor, propertyId: string, input: unknown) {
  await getOwnedListing(actor, propertyId);
  const data = parseOrThrow(availabilitySchema, input);
  await db.$transaction(async (tx) => {
    await tx.property.update({ where: { id: propertyId }, data: { availableFrom: parseCalendarDate(data.availableFrom) } });
    for (const room of data.rooms ?? []) {
      const existing = await tx.roomType.findFirst({ where: { id: room.id, propertyId }, select: { totalBeds: true, name: true } });
      if (!existing) throw notFound("Room type not found.");
      if (room.availableBeds > existing.totalBeds) {
        throw invalid(`${existing.name}: available beds can't exceed ${existing.totalBeds}.`);
      }
      await tx.roomType.update({ where: { id: room.id }, data: { availableBeds: room.availableBeds } });
    }
  });
}

// ─── Admin moderation ─────────────────────────────────────────

async function moderate(
  admin: Actor,
  propertyId: string,
  action: Extract<ListingAction, "approve" | "reject" | "unpublish">,
  reason?: string,
) {
  assertRole(admin, ["ADMIN"]);
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, title: true, status: true, ownerId: true, slug: true } });
  if (!property) throw notFound("Listing not found.");
  if (!canTransition(action, property.status, admin.role)) {
    throw conflict(`This listing is ${property.status.toLowerCase().replace("_", " ")} and can't be ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "unpublished"}.`);
  }
  const transition = LISTING_TRANSITIONS[action];
  const now = new Date();

  await db.$transaction(async (tx) => {
    const updated = await tx.property.updateMany({
      where: { id: propertyId, status: { in: transition.from } },
      data: {
        status: transition.to,
        reviewedAt: now,
        reviewedById: admin.id,
        ...(action === "approve" ? { publishedAt: now, rejectionReason: null } : {}),
        ...(action === "reject" || action === "unpublish" ? { rejectionReason: reason, isFeatured: false } : {}),
      },
    });
    if (updated.count !== 1) throw conflict("This listing was changed by someone else. Refresh and try again.");
    await logActivity(
      {
        actorId: admin.id,
        action: `listing.${action}`,
        entityType: "Property",
        entityId: propertyId,
        summary: `${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Unpublished"} "${property.title}"${reason ? `: ${reason}` : ""}`,
        metadata: { from: property.status, to: transition.to, ...(reason ? { reason } : {}) },
      },
      tx,
    );
  });

  const messages = {
    approve: { type: "LISTING_APPROVED", title: "Your listing is live", body: `"${property.title}" was approved and is now visible to tenants.` },
    reject: { type: "LISTING_REJECTED", title: "Changes requested for your listing", body: `"${property.title}" needs changes before it can be published. Reason: ${reason}` },
    unpublish: { type: "LISTING_UNPUBLISHED", title: "Your listing was unpublished", body: `"${property.title}" was unpublished by an administrator. Reason: ${reason}` },
  } as const;
  await notifyUser({ userId: property.ownerId, ...messages[action], link: `/dashboard/listings/${property.id}`, category: "listing" });
}

export async function approveListing(admin: Actor, propertyId: string) {
  await moderate(admin, propertyId, "approve");
}

export async function rejectListing(admin: Actor, input: unknown) {
  const data = parseOrThrow(listingReasonSchema, input);
  await moderate(admin, data.propertyId, "reject", data.reason);
}

export async function unpublishListing(admin: Actor, input: unknown) {
  const data = parseOrThrow(listingReasonSchema, input);
  await moderate(admin, data.propertyId, "unpublish", data.reason);
}

export async function setListingFeatured(admin: Actor, propertyId: string, featured: boolean) {
  assertRole(admin, ["ADMIN"]);
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { title: true, status: true } });
  if (!property) throw notFound("Listing not found.");
  if (featured && property.status !== "PUBLISHED") throw conflict("Only published listings can be featured.");
  await db.$transaction(async (tx) => {
    await tx.property.update({ where: { id: propertyId }, data: { isFeatured: featured } });
    await logActivity(
      { actorId: admin.id, action: featured ? "listing.feature" : "listing.unfeature", entityType: "Property", entityId: propertyId, summary: `${featured ? "Featured" : "Removed from featured"}: "${property.title}"` },
      tx,
    );
  });
}
