import type { BathroomType, BillingPeriod, Furnishing } from "@/generated/prisma/enums";
import { parseCalendarDate } from "@/lib/dates";

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

export type SearchFilters = {
  q?: string;
  city?: string;
  area?: string;
  type?: string;
  minRent?: number;
  maxRent?: number;
  period?: BillingPeriod;
  beds?: number;
  baths?: number;
  minArea?: number;
  maxArea?: number;
  furnishing: Furnishing[];
  available?: string;
  bathroom?: BathroomType;
  amenities: string[];
  pets?: "allowed" | "considered";
  hideDemo: boolean;
  sort: SortOption;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FURNISHING: Furnishing[] = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"];
const PERIODS: BillingPeriod[] = ["MONTHLY", "WEEKLY", "DAILY"];

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function list(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

function int(value: string | string[] | undefined, min: number, max: number): number | undefined {
  const v = first(value);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

function slug(value: string | string[] | undefined): string | undefined {
  const v = first(value)?.toLowerCase();
  return v && SLUG.test(v) && v.length <= 80 ? v : undefined;
}

/**
 * Parses URL search params leniently: anything invalid is ignored rather than
 * causing an error, so shared or hand-edited links still work.
 */
export function parseSearchParams(raw: RawParams): SearchFilters {
  const q = first(raw.q)?.slice(0, 100);
  let minRent = int(raw.minRent, 0, 100_000_000);
  let maxRent = int(raw.maxRent, 0, 100_000_000);
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent) [minRent, maxRent] = [maxRent, minRent];
  let minArea = int(raw.minArea, 0, 1_000_000);
  let maxArea = int(raw.maxArea, 0, 1_000_000);
  if (minArea !== undefined && maxArea !== undefined && minArea > maxArea) [minArea, maxArea] = [maxArea, minArea];

  const period = first(raw.period)?.toUpperCase() as BillingPeriod | undefined;
  const bathroom = first(raw.bathroom)?.toUpperCase();
  const pets = first(raw.pets);
  const sort = first(raw.sort) as SortOption | undefined;
  const available = first(raw.available);

  return {
    q,
    city: slug(raw.city),
    area: slug(raw.area),
    type: slug(raw.type),
    minRent,
    maxRent,
    period: period && PERIODS.includes(period) ? period : undefined,
    beds: int(raw.beds, 0, 20),
    baths: int(raw.baths, 0, 20),
    minArea,
    maxArea,
    furnishing: [...new Set(list(raw.furnishing).map((f) => f.toUpperCase()))].filter((f): f is Furnishing =>
      FURNISHING.includes(f as Furnishing),
    ),
    available: available && parseCalendarDate(available) ? available : undefined,
    bathroom: bathroom === "PRIVATE" || bathroom === "SHARED" ? bathroom : undefined,
    amenities: [...new Set(list(raw.amenities).map((a) => a.toLowerCase()))].filter((a) => SLUG.test(a)).slice(0, 20),
    pets: pets === "allowed" || pets === "considered" ? pets : undefined,
    hideDemo: first(raw.demo) === "hide",
    sort: sort && SORT_OPTIONS.some((o) => o.value === sort) ? sort : q ? "relevance" : "newest",
    page: int(raw.page, 1, 1000) ?? 1,
  };
}

/** Serialises filters back into a query string, omitting defaults. */
export function buildSearchQuery(filters: Partial<SearchFilters>, overrides: Partial<SearchFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };
  set("q", merged.q);
  set("city", merged.city);
  set("area", merged.area);
  set("type", merged.type);
  set("minRent", merged.minRent);
  set("maxRent", merged.maxRent);
  set("period", merged.period?.toLowerCase());
  set("beds", merged.beds);
  set("baths", merged.baths);
  set("minArea", merged.minArea);
  set("maxArea", merged.maxArea);
  if (merged.furnishing?.length) set("furnishing", merged.furnishing.map((f) => f.toLowerCase()).join(","));
  set("available", merged.available);
  set("bathroom", merged.bathroom?.toLowerCase());
  if (merged.amenities?.length) set("amenities", merged.amenities.join(","));
  set("pets", merged.pets);
  if (merged.hideDemo) set("demo", "hide");
  const defaultSort = merged.q ? "relevance" : "newest";
  if (merged.sort && merged.sort !== defaultSort) set("sort", merged.sort);
  if (merged.page && merged.page > 1) set("page", merged.page);
  return params.toString();
}

export function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  const scalar: (keyof SearchFilters)[] = [
    "city", "area", "type", "minRent", "maxRent", "period", "beds", "baths", "minArea", "maxArea", "available", "bathroom", "pets",
  ];
  for (const key of scalar) if (filters[key] !== undefined) count++;
  count += filters.furnishing.length + filters.amenities.length + (filters.hideDemo ? 1 : 0);
  return count;
}

/** Scores how well a listing matches free-text search terms (used for "Most relevant"). */
export function relevanceScore(
  terms: string[],
  listing: { title: string; description: string; approximateArea: string | null; cityName: string; areaName: string; categoryName: string; isFeatured: boolean; publishedAt: Date | null },
  now = Date.now(),
): number {
  const title = listing.title.toLowerCase();
  const description = listing.description.toLowerCase();
  const location = `${listing.areaName} ${listing.cityName} ${listing.approximateArea ?? ""}`.toLowerCase();
  const category = listing.categoryName.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 6;
    if (location.includes(term)) score += 5;
    if (category.includes(term)) score += 4;
    if (description.includes(term)) score += 1;
  }
  if (listing.isFeatured) score += 1;
  if (listing.publishedAt) {
    const ageDays = (now - listing.publishedAt.getTime()) / 86_400_000;
    score += Math.max(0, 1 - ageDays / 60);
  }
  return score;
}

const STOP_WORDS = new Set(["in", "at", "the", "for", "and", "to", "of", "near", "with", "a", "an", "on"]);

export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  return [...new Set(q.toLowerCase().split(/[\s,]+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t)))].slice(0, 8);
}
