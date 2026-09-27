import { z } from "zod";
import {
  AddressVisibility,
  BathroomType,
  BillingPeriod,
  Furnishing,
  PetPolicy,
  TenantPreference,
} from "@/generated/prisma/enums";
import {
  calendarDate,
  checkbox,
  optionalEnum,
  optionalFloat,
  optionalId,
  optionalInt,
  optionalText,
  requiredInt,
  text,
} from "@/lib/validation/common";

export const LISTING_STEPS = [
  { key: "type", label: "Property type" },
  { key: "location", label: "Location" },
  { key: "details", label: "Details" },
  { key: "pricing", label: "Rent & fees" },
  { key: "amenities", label: "Amenities & rules" },
  { key: "photos", label: "Photos" },
  { key: "review", label: "Preview & submit" },
] as const;

export type ListingStepKey = (typeof LISTING_STEPS)[number]["key"];

export const MAX_MONEY = 100_000_000;
export const MIN_PHOTOS_TO_SUBMIT = 3;
export const MAX_PHOTOS = 20;

export const typeStepSchema = z.object({
  categoryId: z.string().min(1, "Choose a property type"),
});

export const locationStepSchema = z.object({
  cityId: z.string().min(1, "Choose a city"),
  neighborhoodId: optionalId,
  approximateArea: optionalText("Nearby landmark", 120),
  addressLine: optionalText("Full address", 200),
  latitude: optionalFloat("Latitude", -90, 90),
  longitude: optionalFloat("Longitude", -180, 180),
  addressVisibility: z.enum(AddressVisibility),
});

export const roomTypeSchema = z
  .object({
    id: optionalId,
    name: text("Room type name", 2, 80),
    bedsPerRoom: requiredInt("Beds per room", 1, 30),
    totalBeds: requiredInt("Total beds", 1, 1000),
    availableBeds: requiredInt("Available beds", 0, 1000),
    pricePerBed: requiredInt("Price per bed", 100, MAX_MONEY),
    billingPeriod: z.enum(BillingPeriod),
    bathroomType: z.enum(BathroomType),
    description: optionalText("Room description", 300),
  })
  .refine((room) => room.availableBeds <= room.totalBeds, {
    path: ["availableBeds"],
    message: "Available beds can't be more than total beds",
  });

export const detailsStepSchema = z.object({
  title: text("Title", 10, 120),
  description: text("Description", 50, 5000),
  bedrooms: optionalInt("Bedrooms", 0, 50),
  bathrooms: optionalInt("Bathrooms", 0, 50),
  floorAreaSqft: optionalInt("Floor area", 30, 1_000_000),
  floorNumber: optionalInt("Floor", -3, 200),
  totalFloors: optionalInt("Total floors", 1, 200),
  furnishing: optionalEnum(Furnishing),
  bathroomType: optionalEnum(BathroomType),
  availableFrom: calendarDate("Available date"),
  minimumStay: optionalInt("Minimum stay", 1, 365),
  tenantPreference: z.enum(TenantPreference),
  includedFacilities: optionalText("Included facilities", 1000),
  roomTypes: z.array(roomTypeSchema).max(20, "Add at most 20 room types").optional(),
});

export const pricingStepSchema = z.object({
  rentAmount: optionalInt("Rent", 100, MAX_MONEY),
  billingPeriod: z.enum(BillingPeriod),
  rentNegotiable: checkbox,
  securityDeposit: optionalInt("Security deposit", 0, MAX_MONEY),
  advanceRentMonths: optionalInt("Advance rent", 0, 24),
  serviceCharge: optionalInt("Service charge", 0, MAX_MONEY),
  utilitiesIncluded: checkbox,
  utilitiesNote: optionalText("Utilities note", 300),
  otherFees: optionalText("Other fees", 500),
});

export const amenitiesStepSchema = z.object({
  amenityIds: z.array(z.string().max(40)).max(80),
  petPolicy: z.enum(PetPolicy),
  smokingAllowed: checkbox,
  houseRules: optionalText("House rules", 2000),
});

export const availabilitySchema = z.object({
  availableFrom: calendarDate("Available date"),
  rooms: z
    .array(z.object({ id: z.string().min(1), availableBeds: requiredInt("Available beds", 0, 1000) }))
    .max(20)
    .optional(),
});

export const photoOrderSchema = z.object({
  propertyId: z.string().min(1),
  photoIds: z.array(z.string().min(1)).max(50),
});

export type LocationStepInput = z.input<typeof locationStepSchema>;
export type DetailsStepInput = z.input<typeof detailsStepSchema>;
export type PricingStepInput = z.input<typeof pricingStepSchema>;
export type AmenitiesStepInput = z.input<typeof amenitiesStepSchema>;
