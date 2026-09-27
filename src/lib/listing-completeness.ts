import type { ListingStepKey } from "@/lib/validation/listing";
import { MIN_PHOTOS_TO_SUBMIT } from "@/lib/validation/listing";

export type CompletenessInput = {
  cityId: string | null;
  title: string;
  description: string;
  availableFrom: Date | null;
  rentAmount: number | null;
  usesRoomTypes: boolean;
  roomTypeCount: number;
  photoCount: number;
};

export type MissingItem = { step: ListingStepKey; message: string };

/** Lists everything still required before a listing can be submitted for approval. */
export function listingCompleteness(input: CompletenessInput): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!input.cityId) missing.push({ step: "location", message: "Choose the city and area" });
  if (input.title.trim().length < 10) missing.push({ step: "details", message: "Add a title (at least 10 characters)" });
  if (input.description.trim().length < 50) missing.push({ step: "details", message: "Add a description (at least 50 characters)" });
  if (!input.availableFrom) missing.push({ step: "details", message: "Set the date the property is available" });
  if (input.usesRoomTypes && input.roomTypeCount === 0) missing.push({ step: "details", message: "Add at least one room type with beds and prices" });
  if (!input.usesRoomTypes && !input.rentAmount) missing.push({ step: "pricing", message: "Enter the rent" });
  if (input.photoCount < MIN_PHOTOS_TO_SUBMIT) {
    missing.push({ step: "photos", message: `Upload at least ${MIN_PHOTOS_TO_SUBMIT} photos (${input.photoCount} so far)` });
  }
  return missing;
}
