"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth/session";
import { handleAction } from "@/server/action-utils";
import {
  adminCreateResetLink,
  changeUserRole,
  createCountry,
  resolveReport,
  saveAmenity,
  saveCategory,
  saveCity,
  saveNeighborhood,
  setUserSuspended,
  updateSiteSettings,
} from "@/server/services/admin";
import { approveListing, rejectListing, setListingFeatured, unpublishListing } from "@/server/services/listings";

const admin = () => requireActionUser(["ADMIN"]);

function refresh() {
  revalidatePath("/", "layout");
}

export async function approveListingAction(propertyId: string) {
  return handleAction(async () => {
    await approveListing(await admin(), String(propertyId));
    refresh();
  }, "Listing approved and published.");
}

export async function rejectListingAction(input: unknown) {
  return handleAction(async () => {
    await rejectListing(await admin(), input);
    refresh();
  }, "Listing rejected. The owner was told what to change.");
}

export async function unpublishListingAction(input: unknown) {
  return handleAction(async () => {
    await unpublishListing(await admin(), input);
    refresh();
  }, "Listing unpublished.");
}

export async function setFeaturedAction(propertyId: string, featured: boolean) {
  return handleAction(async () => {
    await setListingFeatured(await admin(), String(propertyId), Boolean(featured));
    refresh();
  }, featured ? "Listing featured on the homepage." : "Listing removed from featured.");
}

export async function changeUserRoleAction(input: unknown) {
  return handleAction(async () => {
    await changeUserRole(await admin(), input);
    refresh();
  }, "Role updated. The user will need to sign in again.");
}

export async function setUserSuspendedAction(userId: string, suspend: boolean) {
  return handleAction(async () => {
    await setUserSuspended(await admin(), String(userId), Boolean(suspend));
    refresh();
  }, suspend ? "Account suspended and signed out." : "Account reactivated.");
}

export async function createResetLinkAction(userId: string) {
  return handleAction(async () => adminCreateResetLink(await admin(), String(userId)), "Reset link created. It expires in 1 hour.");
}

export async function resolveReportAction(input: unknown) {
  return handleAction(async () => {
    await resolveReport(await admin(), input);
    refresh();
  }, "Report updated.");
}

export async function createCountryAction(input: unknown) {
  return handleAction(async () => {
    await createCountry(await admin(), input);
    refresh();
  }, "Country added.");
}

export async function saveCityAction(input: unknown) {
  return handleAction(async () => {
    await saveCity(await admin(), input);
    refresh();
  }, "City saved.");
}

export async function saveNeighborhoodAction(input: unknown) {
  return handleAction(async () => {
    await saveNeighborhood(await admin(), input);
    refresh();
  }, "Area saved.");
}

export async function saveCategoryAction(input: unknown) {
  return handleAction(async () => {
    await saveCategory(await admin(), input);
    refresh();
  }, "Category saved.");
}

export async function saveAmenityAction(input: unknown) {
  return handleAction(async () => {
    await saveAmenity(await admin(), input);
    refresh();
  }, "Amenity saved.");
}

export async function updateSiteSettingsAction(input: unknown) {
  return handleAction(async () => {
    await updateSiteSettings(await admin(), input);
    refresh();
  }, "Settings saved.");
}
