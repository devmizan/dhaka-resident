import { describe, expect, it } from "vitest";
import { parseCalendarDate, rangesOverlap, utcToZonedParts, zonedDateTimeToUtc } from "@/lib/dates";
import { formatMoney, formatRent } from "@/lib/format";
import { listingCompleteness } from "@/lib/listing-completeness";
import { availableOwnerActions, canTransition, statusAfterContentEdit } from "@/lib/listing-status";
import { safeRedirectPath, slugify } from "@/lib/utils";

describe("listing status transitions", () => {
  it("only lets admins approve, reject and unpublish", () => {
    expect(canTransition("approve", "PENDING_REVIEW", "ADMIN")).toBe(true);
    expect(canTransition("approve", "PENDING_REVIEW", "OWNER")).toBe(false);
    expect(canTransition("reject", "PENDING_REVIEW", "TENANT")).toBe(false);
    expect(canTransition("unpublish", "PUBLISHED", "OWNER")).toBe(false);
  });

  it("only lets owners submit, pause and mark rented", () => {
    expect(canTransition("submit", "DRAFT", "OWNER")).toBe(true);
    expect(canTransition("submit", "DRAFT", "ADMIN")).toBe(false);
    expect(canTransition("pause", "PUBLISHED", "OWNER")).toBe(true);
    expect(canTransition("markRented", "PAUSED", "OWNER")).toBe(true);
  });

  it("rejects transitions from the wrong state", () => {
    expect(canTransition("approve", "DRAFT", "ADMIN")).toBe(false);
    expect(canTransition("pause", "DRAFT", "OWNER")).toBe(false);
    expect(canTransition("submit", "PUBLISHED", "OWNER")).toBe(false);
  });

  it("sends edited approved listings back to review", () => {
    expect(statusAfterContentEdit("PUBLISHED")).toBe("PENDING_REVIEW");
    expect(statusAfterContentEdit("PAUSED")).toBe("PENDING_REVIEW");
    expect(statusAfterContentEdit("DRAFT")).toBe("DRAFT");
    expect(statusAfterContentEdit("REJECTED")).toBe("REJECTED");
  });

  it("lists owner actions per status", () => {
    expect(availableOwnerActions("PUBLISHED").sort()).toEqual(["markRented", "pause"]);
    expect(availableOwnerActions("PENDING_REVIEW")).toEqual(["withdraw"]);
  });
});

describe("listing completeness", () => {
  const complete = { cityId: "c", title: "A proper listing title", description: "x".repeat(60), availableFrom: new Date(), rentAmount: 1000, usesRoomTypes: false, roomTypeCount: 0, photoCount: 3 };

  it("accepts a complete listing", () => {
    expect(listingCompleteness(complete)).toEqual([]);
  });

  it("reports what is missing, per step", () => {
    const missing = listingCompleteness({ ...complete, cityId: null, rentAmount: null, photoCount: 1 });
    expect(missing.map((m) => m.step)).toEqual(["location", "pricing", "photos"]);
  });

  it("requires room types instead of rent for per-bed categories", () => {
    const missing = listingCompleteness({ ...complete, usesRoomTypes: true, rentAmount: null, roomTypeCount: 0 });
    expect(missing.map((m) => m.step)).toEqual(["details"]);
  });
});

describe("dates and time zones", () => {
  it("converts Dhaka wall-clock time to UTC (UTC+6)", () => {
    expect(zonedDateTimeToUtc("2026-10-01", "14:30", "Asia/Dhaka")?.toISOString()).toBe("2026-10-01T08:30:00.000Z");
    expect(zonedDateTimeToUtc("2026-10-01", "03:00", "Asia/Dhaka")?.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("round-trips UTC back to local parts", () => {
    expect(utcToZonedParts(new Date("2026-10-01T08:30:00Z"), "Asia/Dhaka")).toEqual({ date: "2026-10-01", time: "14:30" });
  });

  it("rejects impossible dates and times", () => {
    expect(parseCalendarDate("2026-02-31")).toBeNull();
    expect(parseCalendarDate("01/10/2026")).toBeNull();
    expect(zonedDateTimeToUtc("2026-10-01", "25:00", "Asia/Dhaka")).toBeNull();
  });

  it("detects overlapping ranges but not touching ones", () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 1, h, m));
    expect(rangesOverlap(at(10), at(11), at(10, 30), at(11, 30))).toBe(true);
    expect(rangesOverlap(at(10), at(11), at(11), at(12))).toBe(false);
  });
});

describe("formatting", () => {
  it("formats taka with South Asian digit grouping", () => {
    expect(formatMoney(150000)).toBe("৳1,50,000");
    expect(formatRent(4500, "MONTHLY", "BDT", true)).toEqual({ amount: "৳4,500", suffix: "/ bed / month" });
  });
});

describe("utils", () => {
  it("only allows same-site redirects", () => {
    expect(safeRedirectPath("/dashboard/saved")).toBe("/dashboard/saved");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });

  it("creates URL-safe slugs", () => {
    expect(slugify("Sea-view flat in Cox's Bazar!")).toBe("sea-view-flat-in-cox-s-bazar");
  });
});
