"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth/session";
import { invalid } from "@/lib/errors";
import { LISTING_STEPS, type ListingStepKey } from "@/lib/validation/listing";
import { handleAction } from "@/server/action-utils";
import {
  changeListingStatus,
  createDraftListing,
  deleteListing,
  removePhoto,
  reorderPhotos,
  saveAmenitiesStep,
  saveDetailsStep,
  saveLocationStep,
  savePricingStep,
  saveTypeStep,
  submitListing,
  updateAvailability,
  type OwnerListingAction,
} from "@/server/services/listings";
import { cancelViewingSlot, createViewingSlot } from "@/server/services/viewings";

export async function createDraftAction(input: unknown) {
  const result = await handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    return createDraftListing(user, input);
  });
  if (!result.ok) return result;
  redirect(`/dashboard/listings/${result.data}/edit/location`);
}

const SAVERS = {
  type: saveTypeStep,
  location: saveLocationStep,
  details: saveDetailsStep,
  pricing: savePricingStep,
  amenities: saveAmenitiesStep,
} as const;

export async function saveListingStepAction(propertyId: string, step: ListingStepKey, input: unknown, next?: "continue" | "stay") {
  const result = await handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    const saver = SAVERS[step as keyof typeof SAVERS];
    if (!saver) throw invalid("Unknown step.");
    await saver(user, String(propertyId), input);
    revalidatePath(`/dashboard/listings/${propertyId}`, "layout");
  }, "Saved.");
  if (!result.ok || next !== "continue") return result;
  const index = LISTING_STEPS.findIndex((s) => s.key === step);
  const following = LISTING_STEPS[index + 1]?.key ?? "review";
  redirect(`/dashboard/listings/${propertyId}/edit/${following}`);
}

export async function submitListingAction(propertyId: string) {
  const result = await handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await submitListing(user, String(propertyId));
    revalidatePath("/dashboard/listings", "layout");
  });
  if (!result.ok) return result;
  redirect(`/dashboard/listings/${propertyId}?submitted=1`);
}

const STATUS_MESSAGES: Record<OwnerListingAction, string> = {
  withdraw: "Listing withdrawn and moved back to drafts.",
  pause: "Listing paused. It's hidden from search until you resume it.",
  resume: "Listing is live again.",
  markRented: "Marked as rented. It's no longer shown to tenants.",
  relist: "Listing is live again.",
};

export async function changeListingStatusAction(propertyId: string, action: OwnerListingAction) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await changeListingStatus(user, String(propertyId), action);
    revalidatePath("/", "layout");
  }, STATUS_MESSAGES[action] ?? "Updated.");
}

export async function deleteListingAction(propertyId: string) {
  const result = await handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await deleteListing(user, String(propertyId));
    revalidatePath("/dashboard/listings");
  });
  if (!result.ok) return result;
  redirect("/dashboard/listings?deleted=1");
}

export async function reorderPhotosAction(propertyId: string, photoIds: string[]) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    if (!Array.isArray(photoIds)) throw invalid("Invalid photo order.");
    await reorderPhotos(user, String(propertyId), photoIds.map(String));
    revalidatePath(`/dashboard/listings/${propertyId}`, "layout");
  });
}

export async function removePhotoAction(propertyId: string, photoId: string) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await removePhoto(user, String(propertyId), String(photoId));
    revalidatePath(`/dashboard/listings/${propertyId}`, "layout");
  }, "Photo removed.");
}

export async function updateAvailabilityAction(propertyId: string, input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await updateAvailability(user, String(propertyId), input);
    revalidatePath("/", "layout");
  }, "Availability updated.");
}

export async function createViewingSlotAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await createViewingSlot(user, input);
    revalidatePath("/dashboard", "layout");
  }, "Viewing time added.");
}

export async function cancelViewingSlotAction(slotId: string) {
  return handleAction(async () => {
    const user = await requireActionUser(["OWNER"]);
    await cancelViewingSlot(user, String(slotId));
    revalidatePath("/dashboard", "layout");
  }, "Viewing time removed. Affected tenants were notified.");
}
