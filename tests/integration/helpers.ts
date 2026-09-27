import { randomUUID } from "node:crypto";
import type { Role } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

export async function resetDatabase() {
  const tables = await db.$queryRaw<{ TABLE_NAME: string }[]>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations' AND TABLE_TYPE = 'BASE TABLE'`;
  const names = tables.map((t) => t.TABLE_NAME ?? (t as unknown as { table_name: string }).table_name);
  if (!names.length) return;
  // Runs in a transaction so every statement uses the same connection: FOREIGN_KEY_CHECKS
  // is a session setting, and disabling it lets the tables be cleared in any order.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    for (const name of names) await tx.$executeRawUnsafe(`DELETE FROM \`${name}\``);
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  });
}

let passwordHash: string | null = null;
export const TEST_PASSWORD = "correct-horse-42";

export async function createUser(role: Role, overrides: { email?: string; name?: string; status?: "ACTIVE" | "SUSPENDED" } = {}) {
  passwordHash ??= await hashPassword(TEST_PASSWORD);
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`,
      name: overrides.name ?? `${role} user`,
      role,
      status: overrides.status ?? "ACTIVE",
      passwordHash,
    },
  });
  return { id: user.id, role: user.role, name: user.name, email: user.email };
}

export async function createReferenceData() {
  const country = await db.country.create({ data: { code: "BD", name: "Bangladesh", currencyCode: "BDT", currencySymbol: "৳", timeZone: "Asia/Dhaka" } });
  const dhaka = await db.city.create({ data: { countryId: country.id, name: "Dhaka", slug: "dhaka" } });
  const sylhet = await db.city.create({ data: { countryId: country.id, name: "Sylhet", slug: "sylhet" } });
  const gulshan = await db.neighborhood.create({ data: { cityId: dhaka.id, name: "Gulshan", slug: "gulshan" } });
  const mirpur = await db.neighborhood.create({ data: { cityId: dhaka.id, name: "Mirpur", slug: "mirpur" } });
  const apartment = await db.propertyCategory.create({ data: { slug: "apartment", name: "Apartment", pluralName: "Apartments" } });
  const hostel = await db.propertyCategory.create({ data: { slug: "hostel", name: "Hostel", pluralName: "Hostels", usesRoomTypes: true } });
  const lift = await db.amenity.create({ data: { slug: "lift", name: "Lift", group: "BUILDING" } });
  const wifi = await db.amenity.create({ data: { slug: "wifi", name: "Wi-Fi" } });
  const stepFree = await db.amenity.create({ data: { slug: "step-free-access", name: "Step-free access", group: "ACCESSIBILITY" } });
  return { country, dhaka, sylhet, gulshan, mirpur, apartment, hostel, lift, wifi, stepFree };
}

export type Refs = Awaited<ReturnType<typeof createReferenceData>>;

type PropertyOverrides = Partial<{
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "PAUSED" | "RENTED" | "REJECTED" | "UNPUBLISHED";
  title: string;
  cityId: string;
  neighborhoodId: string | null;
  categoryId: string;
  rentAmount: number;
  billingPeriod: "MONTHLY" | "WEEKLY" | "DAILY";
  bedrooms: number;
  bathrooms: number;
  floorAreaSqft: number;
  furnishing: "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
  petPolicy: "ALLOWED" | "NEGOTIABLE" | "NOT_ALLOWED";
  availableFrom: Date;
  amenityIds: string[];
  isDemo: boolean;
  photos: number;
  publishedAt: Date;
}>;

export async function createProperty(ownerId: string, refs: Refs, overrides: PropertyOverrides = {}) {
  const status = overrides.status ?? "PUBLISHED";
  const id = randomUUID().slice(0, 8);
  return db.property.create({
    data: {
      slug: `test-${id}`,
      ownerId,
      status,
      categoryId: overrides.categoryId ?? refs.apartment.id,
      title: overrides.title ?? `Test apartment ${id} in Dhaka`,
      description: "A description that is certainly longer than fifty characters for validation purposes.",
      cityId: overrides.cityId ?? refs.dhaka.id,
      neighborhoodId: overrides.neighborhoodId === undefined ? refs.gulshan.id : overrides.neighborhoodId,
      rentAmount: overrides.rentAmount ?? 30000,
      billingPeriod: overrides.billingPeriod ?? "MONTHLY",
      bedrooms: overrides.bedrooms ?? 2,
      bathrooms: overrides.bathrooms ?? 2,
      floorAreaSqft: overrides.floorAreaSqft ?? 1000,
      furnishing: overrides.furnishing ?? "UNFURNISHED",
      petPolicy: overrides.petPolicy ?? "NOT_ALLOWED",
      availableFrom: overrides.availableFrom ?? new Date(Date.UTC(2026, 0, 1)),
      isDemo: overrides.isDemo ?? false,
      publishedAt: status === "PUBLISHED" ? (overrides.publishedAt ?? new Date()) : null,
      amenities: overrides.amenityIds ? { create: overrides.amenityIds.map((amenityId) => ({ amenityId })) } : undefined,
      photos: { create: Array.from({ length: overrides.photos ?? 3 }, (_, i) => ({ url: `/demo-photos/living-${i + 1}.webp`, sortOrder: i })) },
    },
  });
}

/** A future "YYYY-MM-DD" date string, n days from now. */
export function futureDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export const key = () => randomUUID();
