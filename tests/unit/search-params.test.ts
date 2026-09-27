import { describe, expect, it } from "vitest";
import { buildSearchQuery, countActiveFilters, parseSearchParams, relevanceScore, searchTerms } from "@/lib/search-params";

describe("parseSearchParams", () => {
  it("parses a full set of filters from the URL", () => {
    const f = parseSearchParams({
      q: "lake view",
      city: "dhaka",
      area: "gulshan",
      type: "apartment",
      minRent: "20000",
      maxRent: "90000",
      period: "monthly",
      beds: "2",
      baths: "1",
      minArea: "800",
      maxArea: "2000",
      furnishing: "furnished,semi_furnished",
      available: "2026-10-01",
      bathroom: "private",
      amenities: "lift,wifi",
      pets: "considered",
      demo: "hide",
      sort: "price_asc",
      page: "3",
    });
    expect(f).toMatchObject({
      q: "lake view",
      city: "dhaka",
      area: "gulshan",
      type: "apartment",
      minRent: 20000,
      maxRent: 90000,
      period: "MONTHLY",
      beds: 2,
      baths: 1,
      minArea: 800,
      maxArea: 2000,
      furnishing: ["FURNISHED", "SEMI_FURNISHED"],
      available: "2026-10-01",
      bathroom: "PRIVATE",
      amenities: ["lift", "wifi"],
      pets: "considered",
      hideDemo: true,
      sort: "price_asc",
      page: 3,
    });
  });

  it("ignores invalid values instead of failing", () => {
    const f = parseSearchParams({
      city: "../../etc",
      minRent: "-5",
      maxRent: "abc",
      period: "hourly",
      beds: "99",
      furnishing: "luxurious",
      available: "2026-02-31",
      bathroom: "outdoor",
      amenities: "lift,<script>",
      pets: "yes",
      sort: "random",
      page: "0",
    });
    expect(f.city).toBeUndefined();
    expect(f.minRent).toBeUndefined();
    expect(f.maxRent).toBeUndefined();
    expect(f.period).toBeUndefined();
    expect(f.beds).toBeUndefined();
    expect(f.furnishing).toEqual([]);
    expect(f.available).toBeUndefined();
    expect(f.bathroom).toBeUndefined();
    expect(f.amenities).toEqual(["lift"]);
    expect(f.pets).toBeUndefined();
    expect(f.sort).toBe("newest");
    expect(f.page).toBe(1);
  });

  it("swaps an inverted rent range", () => {
    const f = parseSearchParams({ minRent: "50000", maxRent: "10000" });
    expect([f.minRent, f.maxRent]).toEqual([10000, 50000]);
  });

  it("defaults to relevance sorting when there is a keyword", () => {
    expect(parseSearchParams({ q: "gulshan" }).sort).toBe("relevance");
    expect(parseSearchParams({}).sort).toBe("newest");
  });

  it("round-trips through buildSearchQuery so URLs are shareable", () => {
    const original = parseSearchParams({ city: "dhaka", type: "hostel", maxRent: "8000", amenities: "wifi", furnishing: "furnished", page: "2", sort: "price_desc" });
    const query = buildSearchQuery(original);
    const reparsed = parseSearchParams(Object.fromEntries(new URLSearchParams(query)));
    expect(reparsed).toEqual(original);
  });

  it("omits defaults from the query string", () => {
    expect(buildSearchQuery(parseSearchParams({}))).toBe("");
    expect(buildSearchQuery(parseSearchParams({ city: "dhaka" }), { page: 1 })).toBe("city=dhaka");
  });

  it("counts active filters", () => {
    expect(countActiveFilters(parseSearchParams({ city: "dhaka", amenities: "lift,wifi", demo: "hide" }))).toBe(4);
  });
});

describe("relevance", () => {
  const base = { description: "", approximateArea: null, cityName: "Dhaka", areaName: "Gulshan", categoryName: "Apartment", isFeatured: false, publishedAt: null };

  it("ranks title and location matches above description-only matches", () => {
    const terms = searchTerms("lake gulshan");
    const titleMatch = relevanceScore(terms, { ...base, title: "Lake view flat" });
    const descriptionOnly = relevanceScore(terms, { ...base, areaName: "Mirpur", title: "Flat", description: "near a lake" });
    expect(titleMatch).toBeGreaterThan(descriptionOnly);
  });

  it("drops stop words and very short terms", () => {
    expect(searchTerms("flat in the gulshan a")).toEqual(["flat", "gulshan"]);
  });
});
