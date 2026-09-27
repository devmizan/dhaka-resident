import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseSearchParams } from "@/lib/search-params";
import { searchListings } from "@/server/queries/listings";
import { createProperty, createReferenceData, createUser, resetDatabase, type Refs } from "./helpers";

let refs: Refs;
const ids: Record<string, string> = {};

async function search(params: Record<string, string>) {
  const result = await searchListings(parseSearchParams(params));
  return result.items.map((i) => Object.keys(ids).find((k) => ids[k] === i.id));
}

beforeAll(async () => {
  await resetDatabase();
  refs = await createReferenceData();
  const owner = await createUser("OWNER");
  const make = async (key: string, overrides: Parameters<typeof createProperty>[2]) => {
    ids[key] = (await createProperty(owner.id, refs, overrides)).id;
  };
  await make("gulshanLuxury", { title: "Lake view penthouse", rentAmount: 150000, bedrooms: 4, bathrooms: 4, floorAreaSqft: 3000, furnishing: "FURNISHED", petPolicy: "ALLOWED", amenityIds: [refs.lift.id, refs.wifi.id, refs.stepFree.id], publishedAt: new Date(Date.now() - 1000) });
  await make("mirpurBudget", { title: "Budget family flat", neighborhoodId: refs.mirpur.id, rentAmount: 18000, bedrooms: 2, bathrooms: 1, floorAreaSqft: 850, petPolicy: "NEGOTIABLE", amenityIds: [refs.wifi.id], publishedAt: new Date(Date.now() - 2000) });
  await make("sylhetWeekly", { title: "Weekly sublet studio", cityId: refs.sylhet.id, neighborhoodId: null, rentAmount: 9000, billingPeriod: "WEEKLY", bedrooms: 1, bathrooms: 1, availableFrom: new Date(Date.UTC(2030, 0, 1)), isDemo: true, publishedAt: new Date(Date.now() - 3000) });
  await make("hostel", { title: "Green hostel", categoryId: refs.hostel.id, rentAmount: 4500, bedrooms: undefined, amenityIds: [refs.wifi.id, refs.lift.id], publishedAt: new Date(Date.now() - 4000) });
  await make("draft", { status: "DRAFT", title: "Unapproved draft in Gulshan", rentAmount: 20000 });
  await make("paused", { status: "PAUSED", title: "Paused listing", rentAmount: 20000 });
});

afterAll(() => db.$disconnect());

describe("search filters", () => {
  it("only returns published listings, newest first", async () => {
    expect(await search({})).toEqual(["gulshanLuxury", "mirpurBudget", "sylhetWeekly", "hostel"]);
  });

  it("filters by city, neighbourhood and type", async () => {
    expect(await search({ city: "sylhet" })).toEqual(["sylhetWeekly"]);
    expect(await search({ city: "dhaka", area: "mirpur" })).toEqual(["mirpurBudget"]);
    expect(await search({ type: "hostel" })).toEqual(["hostel"]);
  });

  it("filters by rent range and billing period", async () => {
    expect(await search({ minRent: "10000", maxRent: "20000" })).toEqual(["mirpurBudget"]);
    expect(await search({ period: "weekly" })).toEqual(["sylhetWeekly"]);
  });

  it("filters by rooms, area and furnishing", async () => {
    expect(await search({ beds: "3" })).toEqual(["gulshanLuxury"]);
    expect(await search({ baths: "2" })).toEqual(["gulshanLuxury", "hostel"]);
    expect(await search({ minArea: "800", maxArea: "1000" })).toEqual(["mirpurBudget", "sylhetWeekly", "hostel"]);
    expect(await search({ furnishing: "furnished" })).toEqual(["gulshanLuxury"]);
  });

  it("requires every selected amenity, including accessibility features", async () => {
    expect(await search({ amenities: "wifi,lift" })).toEqual(["gulshanLuxury", "hostel"]);
    expect(await search({ amenities: "step-free-access" })).toEqual(["gulshanLuxury"]);
  });

  it("filters by pets, availability and sample content", async () => {
    expect(await search({ pets: "allowed" })).toEqual(["gulshanLuxury"]);
    expect(await search({ pets: "considered" })).toEqual(["gulshanLuxury", "mirpurBudget"]);
    expect(await search({ available: "2026-06-01" })).not.toContain("sylhetWeekly");
    expect(await search({ demo: "hide" })).not.toContain("sylhetWeekly");
  });

  it("matches keywords across title, area and category, and sorts", async () => {
    expect(await search({ q: "lake view" })).toEqual(["gulshanLuxury"]);
    expect(await search({ q: "mirpur" })).toEqual(["mirpurBudget"]);
    expect(await search({ q: "hostels" })).toEqual(["hostel"]);
    expect(await search({ sort: "price_asc" })).toEqual(["hostel", "sylhetWeekly", "mirpurBudget", "gulshanLuxury"]);
    expect(await search({ sort: "price_desc" })).toEqual(["gulshanLuxury", "mirpurBudget", "sylhetWeekly", "hostel"]);
  });

  it("paginates and clamps out-of-range pages", async () => {
    const result = await searchListings(parseSearchParams({ page: "50" }));
    expect(result.total).toBe(4);
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(1);
  });
});
