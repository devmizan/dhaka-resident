import type {
  AddressVisibility,
  AmenityGroup,
  BathroomType,
  BillingPeriod,
  EnquiryStatus,
  Furnishing,
  ListingStatus,
  PetPolicy,
  ReportReason,
  ReportStatus,
  Role,
  TenantPreference,
  UserStatus,
  ViewingStatus,
} from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  TENANT: "Tenant",
  OWNER: "Owner / manager",
  ADMIN: "Administrator",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  PUBLISHED: "Published",
  REJECTED: "Changes requested",
  PAUSED: "Paused",
  RENTED: "Rented",
  UNPUBLISHED: "Unpublished by admin",
};

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
  DAILY: "Daily",
};

export const BILLING_PERIOD_SHORT: Record<BillingPeriod, string> = {
  MONTHLY: "month",
  WEEKLY: "week",
  DAILY: "day",
};

export const FURNISHING_LABELS: Record<Furnishing, string> = {
  FURNISHED: "Furnished",
  SEMI_FURNISHED: "Semi-furnished",
  UNFURNISHED: "Unfurnished",
};

export const BATHROOM_TYPE_LABELS: Record<BathroomType, string> = {
  PRIVATE: "Private bathroom",
  SHARED: "Shared bathroom",
};

export const PET_POLICY_LABELS: Record<PetPolicy, string> = {
  ALLOWED: "Pets allowed",
  NEGOTIABLE: "Pets negotiable",
  NOT_ALLOWED: "No pets",
};

export const TENANT_PREFERENCE_LABELS: Record<TenantPreference, string> = {
  ANY: "Open to all tenants",
  FAMILY: "Families",
  FEMALE_ONLY: "Women only",
  MALE_ONLY: "Men only",
  STUDENTS: "Students",
  PROFESSIONALS: "Working professionals",
};

export const ADDRESS_VISIBILITY_LABELS: Record<AddressVisibility, string> = {
  PUBLIC: "Show the full address publicly",
  AFTER_ACCEPTED_VIEWING: "Show the full address only to tenants with an accepted viewing",
  PRIVATE: "Keep the full address private (share it in messages)",
};

export const AMENITY_GROUP_LABELS: Record<AmenityGroup, string> = {
  ESSENTIALS: "Essentials",
  BUILDING: "Building",
  SAFETY: "Safety & security",
  ACCESSIBILITY: "Accessibility",
};

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
};

export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM_OR_FRAUD: "Suspected scam or fraud",
  INACCURATE_INFORMATION: "Inaccurate information or photos",
  ALREADY_RENTED: "Property is no longer available",
  DUPLICATE: "Duplicate listing",
  OFFENSIVE_CONTENT: "Offensive content",
  DISCRIMINATION: "Discriminatory content",
  OTHER: "Something else",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export function optionsFrom<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}
