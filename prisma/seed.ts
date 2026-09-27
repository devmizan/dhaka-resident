/* Seeds reference data and clearly marked sample content for LOCAL DEVELOPMENT ONLY. */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { generatePassword, hashPassword } from "../src/lib/auth/password";
import { zonedDateTimeToUtc } from "../src/lib/dates";
import { normalizePhone } from "../src/lib/phone";
import { slugify } from "../src/lib/utils";
import { deleteStoredFile } from "../src/server/services/uploads";
import { AMENITIES, CATEGORIES, CITIES, COUNTRY, DEMO_LISTINGS, DEMO_OWNERS, DEMO_TENANTS } from "./seed-data";

const DAY = 86_400_000;

/** SEED_MODE=reference seeds only countries, cities, categories and amenities — safe for production. */
const referenceOnly = process.env.SEED_MODE === "reference";

function assertLocal() {
  if (referenceOnly) return;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error("Refusing to seed demo accounts and listings with NODE_ENV=production.");
    process.exit(1);
  }
}

function calendarDaysFromNow(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

function dhakaTimeInDays(days: number, time: string) {
  const date = calendarDaysFromNow(days).toISOString().slice(0, 10);
  return zonedDateTimeToUtc(date, time, COUNTRY.timeZone)!;
}

async function seedReferenceData() {
  const country = await db.country.upsert({
    where: { code: COUNTRY.code },
    create: COUNTRY,
    update: { name: COUNTRY.name, currencyCode: COUNTRY.currencyCode, currencySymbol: COUNTRY.currencySymbol, timeZone: COUNTRY.timeZone },
  });

  const cityIds = new Map<string, string>();
  const areaIds = new Map<string, string>();
  for (const [index, city] of CITIES.entries()) {
    const record = await db.city.upsert({
      where: { countryId_slug: { countryId: country.id, slug: city.slug } },
      create: { countryId: country.id, slug: city.slug, name: city.name, sortOrder: index, latitude: city.lat, longitude: city.lng },
      update: { name: city.name, latitude: city.lat, longitude: city.lng },
    });
    cityIds.set(city.slug, record.id);
    for (const [slug, name, lat, lng] of city.areas) {
      const area = await db.neighborhood.upsert({
        where: { cityId_slug: { cityId: record.id, slug } },
        create: { cityId: record.id, slug, name, latitude: lat, longitude: lng },
        update: { name, latitude: lat, longitude: lng },
      });
      areaIds.set(`${city.slug}/${slug}`, area.id);
    }
  }

  const categoryIds = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const record = await db.propertyCategory.upsert({
      where: { slug: category.slug },
      create: { ...category, sortOrder: index },
      update: { ...category },
    });
    categoryIds.set(category.slug, record.id);
  }

  const amenityIds = new Map<string, string>();
  for (const [index, amenity] of AMENITIES.entries()) {
    const record = await db.amenity.upsert({
      where: { slug: amenity.slug },
      create: { ...amenity, sortOrder: index },
      update: { name: amenity.name, group: amenity.group, icon: amenity.icon },
    });
    amenityIds.set(amenity.slug, record.id);
  }

  await db.siteSetting.upsert({
    where: { key: "general" },
    create: { key: "general", value: { contactEmail: "support@example.com", contactPhone: "+880 1700-000000", officeAddress: "Dhaka, Bangladesh" } },
    update: {},
  });

  return { cityIds, areaIds, categoryIds, amenityIds };
}

async function seedDemoContent(refs: Awaited<ReturnType<typeof seedReferenceData>>) {
  // Remove previous demo users; their listings, messages and viewings cascade.
  const uploaded = await db.propertyPhoto.findMany({ where: { storageKey: { not: null }, property: { owner: { isDemo: true } } }, select: { storageKey: true } });
  await Promise.all(uploaded.map((photo) => deleteStoredFile(photo.storageKey!)));
  const removed = await db.user.deleteMany({ where: { isDemo: true } });
  if (removed.count) console.log(`Removed ${removed.count} previous demo accounts and their content.`);

  const credentials: { role: string; name: string; email: string; password: string }[] = [];
  const userIds = new Map<string, string>();

  for (const owner of DEMO_OWNERS) {
    const password = generatePassword();
    const user = await db.user.create({
      data: {
        name: owner.name,
        email: owner.email,
        phone: normalizePhone(owner.phone),
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        companyName: owner.companyName,
        bio: owner.bio,
        role: "OWNER",
        isDemo: true,
        passwordHash: await hashPassword(password),
      },
    });
    userIds.set(owner.key, user.id);
    credentials.push({ role: "Owner", name: owner.name, email: owner.email, password });
  }
  for (const tenant of DEMO_TENANTS) {
    const password = generatePassword();
    const user = await db.user.create({
      data: {
        name: tenant.name,
        email: tenant.email,
        phone: normalizePhone(tenant.phone),
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        bio: tenant.bio,
        role: "TENANT",
        isDemo: true,
        passwordHash: await hashPassword(password),
      },
    });
    userIds.set(tenant.key, user.id);
    credentials.push({ role: "Tenant", name: tenant.name, email: tenant.email, password });
  }

  const propertyIds = new Map<string, string>();
  for (const listing of DEMO_LISTINGS) {
    const status = listing.status ?? "PUBLISHED";
    const publishedAt = status === "PUBLISHED" || status === "RENTED" ? new Date(Date.now() - listing.publishedDaysAgo * DAY - Math.floor(Math.random() * 6) * 3_600_000) : null;
    const cheapestRoom = listing.rooms?.reduce((min, r) => (r.pricePerBed < min.pricePerBed ? r : min));
    const property = await db.property.create({
      data: {
        slug: `tmp-${listing.key}`,
        ownerId: userIds.get(listing.owner)!,
        categoryId: refs.categoryIds.get(listing.category)!,
        status,
        isDemo: true,
        isFeatured: Boolean(listing.featured),
        title: listing.title,
        description: `${listing.description}\n\nThis is a sample listing created for demonstration purposes. It is not a real property.`,
        cityId: refs.cityIds.get(listing.city)!,
        neighborhoodId: refs.areaIds.get(`${listing.city}/${listing.area}`)!,
        approximateArea: listing.approximateArea,
        addressLine: listing.addressLine,
        addressVisibility: listing.addressVisibility ?? "PRIVATE",
        rentAmount: cheapestRoom ? cheapestRoom.pricePerBed : (listing.rent ?? null),
        billingPeriod: listing.period ?? "MONTHLY",
        rentNegotiable: Boolean(listing.negotiable),
        securityDeposit: listing.deposit,
        advanceRentMonths: listing.advanceMonths,
        serviceCharge: listing.serviceCharge,
        utilitiesIncluded: Boolean(listing.utilitiesIncluded),
        utilitiesNote: listing.utilitiesNote,
        otherFees: listing.otherFees,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        floorAreaSqft: listing.sqft,
        floorNumber: listing.floor,
        totalFloors: listing.totalFloors,
        furnishing: listing.furnishing,
        bathroomType: listing.bathroomType,
        availableFrom: calendarDaysFromNow(listing.availableInDays),
        minimumStay: listing.minimumStay,
        petPolicy: listing.pets ?? "NOT_ALLOWED",
        smokingAllowed: Boolean(listing.smoking),
        tenantPreference: listing.preference ?? "ANY",
        houseRules: listing.houseRules,
        includedFacilities: listing.facilities,
        rejectionReason: listing.rejectionReason,
        submittedAt: status === "DRAFT" ? null : new Date(Date.now() - (listing.publishedDaysAgo + 1) * DAY),
        publishedAt,
        reviewedAt: publishedAt,
        rentedAt: status === "RENTED" ? new Date(Date.now() - 3 * DAY) : null,
        amenities: { create: listing.amenities.map((slug) => ({ amenityId: refs.amenityIds.get(slug)! })) },
        photos: {
          create: listing.photos.map((photo, index) => ({
            url: `/demo-photos/${photo}.webp`,
            width: 1400,
            height: 933,
            sortOrder: index,
            altText: `${listing.title} — photo ${index + 1}`,
          })),
        },
        roomTypes: listing.rooms
          ? { create: listing.rooms.map((room, index) => ({ ...room, billingPeriod: listing.period ?? "MONTHLY", sortOrder: index })) }
          : undefined,
      },
    });
    const slug = status === "DRAFT" ? `draft-${property.id}` : `${slugify(listing.title)}-${property.id.slice(-6)}`;
    await db.property.update({ where: { id: property.id }, data: { slug } });
    propertyIds.set(listing.key, property.id);
  }

  // ─── Sample activity between demo accounts ───
  const farhana = userIds.get("farhana")!;
  const nusrat = userIds.get("nusrat")!;
  const imran = userIds.get("imran")!;
  const tanvir = userIds.get("tanvir")!;
  const sadia = userIds.get("sadia")!;
  const arif = userIds.get("arif")!;
  const gulshan = propertyIds.get("gulshan-3bed")!;
  const dhanmondi = propertyIds.get("dhanmondi-family")!;
  const mirpurHostel = propertyIds.get("mirpur-hostel")!;

  await db.favorite.createMany({
    data: [
      { userId: sadia, propertyId: gulshan },
      { userId: sadia, propertyId: propertyIds.get("lalmatia-women-hostel")! },
      { userId: sadia, propertyId: propertyIds.get("bashundhara-3bed")! },
      { userId: arif, propertyId: mirpurHostel },
    ],
  });

  const t0 = Date.now() - 2 * DAY;
  const enquiry = await db.enquiry.create({
    data: {
      propertyId: gulshan,
      tenantId: sadia,
      ownerId: farhana,
      moveInDate: calendarDaysFromNow(20),
      occupants: 4,
      lastMessageAt: new Date(t0 + 5 * 3_600_000),
      tenantLastReadAt: new Date(t0 + 5 * 3_600_000),
      ownerLastReadAt: new Date(t0 + 5 * 3_600_000),
      messages: {
        create: [
          { senderId: sadia, body: "Assalamu alaikum. We are a family of four looking to move by next month. Is the apartment still available, and is the service charge fixed?", createdAt: new Date(t0) },
          { senderId: farhana, body: "Walaikum assalam. Yes, it is available from the date shown. The service charge is fixed at ৳8,000 and covers the lift, generator, guards and cleaning of common areas. I've added viewing times this week — please request one that suits you.", createdAt: new Date(t0 + 3 * 3_600_000) },
          { senderId: sadia, body: "Thank you, I've requested a viewing.", createdAt: new Date(t0 + 5 * 3_600_000) },
        ],
      },
    },
  });

  const arifEnquiry = await db.enquiry.create({
    data: {
      propertyId: mirpurHostel,
      tenantId: arif,
      ownerId: nusrat,
      occupants: 1,
      lastMessageAt: new Date(Date.now() - 6 * 3_600_000),
      tenantLastReadAt: new Date(Date.now() - 6 * 3_600_000),
      messages: {
        create: [
          { senderId: arif, body: "Hello, I recently started a job in Mirpur DOHS. Is a bed available in the twin AC room from next week? Are meals included in the price?", createdAt: new Date(Date.now() - 6 * 3_600_000) },
        ],
      },
    },
  });

  await db.enquiry.create({
    data: {
      propertyId: propertyIds.get("motijheel-office")!,
      tenantId: sadia,
      ownerId: imran,
      status: "CLOSED",
      lastMessageAt: new Date(Date.now() - 10 * DAY),
      tenantLastReadAt: new Date(Date.now() - 10 * DAY),
      ownerLastReadAt: new Date(Date.now() - 10 * DAY),
      messages: {
        create: [
          { senderId: sadia, body: "Is the office floor suitable for a 20-person software team?", createdAt: new Date(Date.now() - 11 * DAY) },
          { senderId: imran, body: "Yes, it comfortably seats 25. Closing this thread as you mentioned you found another space — best of luck!", createdAt: new Date(Date.now() - 10 * DAY) },
        ],
      },
    },
  });

  // Viewing slots offered by the owner of the Gulshan apartment.
  const slotA = await db.viewingSlot.create({ data: { propertyId: gulshan, ownerId: farhana, startsAt: dhakaTimeInDays(2, "11:00"), endsAt: dhakaTimeInDays(2, "11:30"), note: "Ask the guard for Flat 6B." } });
  await db.viewingSlot.create({ data: { propertyId: gulshan, ownerId: farhana, startsAt: dhakaTimeInDays(2, "16:00"), endsAt: dhakaTimeInDays(2, "16:30") } });
  await db.viewingSlot.create({ data: { propertyId: gulshan, ownerId: farhana, startsAt: dhakaTimeInDays(4, "12:00"), endsAt: dhakaTimeInDays(4, "12:30") } });
  await db.viewingSlot.create({ data: { propertyId: propertyIds.get("uttara-4bed")!, ownerId: farhana, startsAt: dhakaTimeInDays(3, "10:00"), endsAt: dhakaTimeInDays(3, "10:30") } });
  await db.viewingSlot.create({ data: { propertyId: dhanmondi, ownerId: tanvir, startsAt: dhakaTimeInDays(3, "17:00"), endsAt: dhakaTimeInDays(3, "17:30") } });

  await db.viewingRequest.create({
    data: { propertyId: gulshan, tenantId: sadia, ownerId: farhana, slotId: slotA.id, enquiryId: enquiry.id, startsAt: slotA.startsAt, endsAt: slotA.endsAt, status: "PENDING", tenantNote: "My husband will join me." },
  });
  await db.viewingRequest.create({
    data: { propertyId: mirpurHostel, tenantId: arif, ownerId: nusrat, enquiryId: arifEnquiry.id, startsAt: dhakaTimeInDays(1, "18:30"), endsAt: dhakaTimeInDays(1, "19:00"), status: "ACCEPTED", decidedAt: new Date(), ownerNote: "Please bring a copy of your NID." },
  });
  await db.viewingRequest.create({
    data: { propertyId: dhanmondi, tenantId: sadia, ownerId: tanvir, startsAt: dhakaTimeInDays(1, "15:00"), endsAt: dhakaTimeInDays(1, "15:30"), status: "DECLINED", decidedAt: new Date(), ownerNote: "Sorry, I'm travelling that day. Please pick one of the offered times." },
  });
  await db.viewingRequest.create({
    data: { propertyId: propertyIds.get("banani-serviced")!, tenantId: arif, ownerId: farhana, startsAt: dhakaTimeInDays(5, "11:00"), endsAt: dhakaTimeInDays(5, "11:30"), status: "CANCELLED", cancelledAt: new Date(), cancelledById: arif },
  });

  await db.report.create({
    data: { propertyId: propertyIds.get("tejgaon-showroom")!, reporterId: arif, reason: "INACCURATE_INFORMATION", details: "The frontage looked smaller than 40 ft when I passed by. Could the size be checked?" },
  });

  await db.notification.createMany({
    data: [
      { userId: farhana, type: "VIEWING_REQUESTED", title: "New viewing request", body: `Sadia Islam asked to view "Bright 3-bedroom apartment near Gulshan 2 Circle".`, link: "/dashboard/viewings" },
      { userId: nusrat, type: "ENQUIRY_RECEIVED", title: "New enquiry", body: `Arif Hossain sent an enquiry about "Mirpur professionals' hostel with meals".`, link: `/dashboard/messages/${arifEnquiry.id}` },
      { userId: arif, type: "VIEWING_ACCEPTED", title: "Viewing accepted", body: `Your viewing of "Mirpur professionals' hostel with meals" was accepted.`, link: "/dashboard/viewings" },
      { userId: sadia, type: "VIEWING_DECLINED", title: "Viewing request declined", body: `The owner declined your viewing request for "Family flat near Dhanmondi Lake with 3 bedrooms".`, link: "/dashboard/viewings" },
      { userId: tanvir, type: "LISTING_REJECTED", title: "Changes requested for your listing", body: `"Room available in Tilagor for students" needs changes before it can be published.`, link: `/dashboard/listings/${propertyIds.get("tilagor-rejected")}` },
    ],
  });

  return credentials;
}

async function main() {
  assertLocal();
  console.log("Seeding reference data (country, cities, areas, categories, amenities)…");
  const refs = await seedReferenceData();
  if (referenceOnly) {
    const [cities, categories, amenities] = await Promise.all([db.city.count(), db.propertyCategory.count(), db.amenity.count()]);
    console.log(`\n✔ Reference data ready: ${cities} cities, ${categories} categories, ${amenities} amenities. No demo content was created.\n`);
    return;
  }
  console.log("Seeding sample accounts and listings…");
  const credentials = await seedDemoContent(refs);
  const published = await db.property.count({ where: { isDemo: true, status: "PUBLISHED" } });

  const lines = [
    "Dhaka Resident — LOCAL DEMO CREDENTIALS (development only; regenerated on every seed)",
    `Generated: ${new Date().toISOString()}`,
    "",
    ...credentials.map((c) => `${c.role.padEnd(7)} ${c.name.padEnd(18)} ${c.email.padEnd(30)} ${c.password}`),
    "",
    "Sign in at http://localhost:3000/login",
  ];
  writeFileSync(".demo-credentials.txt", `${lines.join("\n")}\n`, { mode: 0o600 });

  console.log(`\n✔ Seeded ${published} published sample listings.\n`);
  console.log("┌─ Demo accounts (local development only) ───────────────────────────────────");
  for (const c of credentials) console.log(`│ ${c.role.padEnd(7)} ${c.email.padEnd(30)} ${c.password}`);
  console.log("└────────────────────────────────────────────────────────────────────────────");
  console.log("Saved to .demo-credentials.txt (git-ignored). Run `npm run demo:passwords` to generate new ones.");
  console.log("Administrator accounts are created separately: npm run admin:create (or npm run setup).\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
