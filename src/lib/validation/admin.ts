import { z } from "zod";
import { AmenityGroup, ReportStatus, Role } from "@/generated/prisma/enums";
import { checkbox, id, optionalFloat, optionalText, requiredInt, text } from "@/lib/validation/common";

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .or(z.literal(""))
  .optional();

export const listingDecisionSchema = z.object({ propertyId: id });

export const listingReasonSchema = z.object({
  propertyId: id,
  reason: text("Reason", 10, 500),
});

export const changeRoleSchema = z.object({ userId: id, role: z.enum(Role) });
export const userStatusSchema = z.object({ userId: id, suspend: z.boolean() });

export const citySchema = z.object({
  id: id.optional(),
  countryId: id,
  name: text("City name", 2, 80),
  slug: slugField,
  sortOrder: requiredInt("Sort order", 0, 10000),
  isActive: checkbox,
  latitude: optionalFloat("Latitude", -90, 90),
  longitude: optionalFloat("Longitude", -180, 180),
});

export const neighborhoodSchema = z.object({
  id: id.optional(),
  cityId: id,
  name: text("Area name", 2, 80),
  slug: slugField,
  isActive: checkbox,
});

export const countrySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter ISO country code"),
  name: text("Country name", 2, 80),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code"),
  currencySymbol: text("Currency symbol", 1, 5),
  timeZone: text("Time zone", 3, 60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA time zone, e.g. Asia/Dhaka"),
});

export const categorySchema = z.object({
  id: id.optional(),
  name: text("Name", 2, 60),
  pluralName: text("Plural name", 2, 60),
  slug: slugField,
  description: optionalText("Description", 300),
  icon: z.string().trim().max(40).regex(/^[a-z0-9-]+$/, "Use a Lucide icon name, e.g. building-2"),
  usesRoomTypes: checkbox,
  isCommercial: checkbox,
  isActive: checkbox,
  sortOrder: requiredInt("Sort order", 0, 10000),
});

export const amenitySchema = z.object({
  id: id.optional(),
  name: text("Name", 2, 60),
  slug: slugField,
  group: z.enum(AmenityGroup),
  icon: z.string().trim().max(40).regex(/^[a-z0-9-]+$/, "Use a Lucide icon name, e.g. wifi"),
  isActive: checkbox,
  sortOrder: requiredInt("Sort order", 0, 10000),
});

export const reportResolutionSchema = z.object({
  reportId: id,
  status: z.enum([ReportStatus.RESOLVED, ReportStatus.DISMISSED]),
  resolutionNote: text("Resolution note", 5, 1000),
  unpublishListing: checkbox,
});

export const siteSettingsSchema = z.object({
  contactEmail: z.email("Enter a valid email").max(254),
  contactPhone: optionalText("Phone", 40),
  officeAddress: optionalText("Address", 200),
  announcement: optionalText("Announcement", 240),
});

export type SiteSettings = z.output<typeof siteSettingsSchema>;
