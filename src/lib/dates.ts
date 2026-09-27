/** Parses "YYYY-MM-DD" into a Date at UTC midnight, or null if invalid. */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject overflow such as 2026-02-31.
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Formats a UTC-midnight date back into "YYYY-MM-DD" (for date inputs). */
export function toCalendarDateString(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function todayCalendarDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock time in a time zone ("2026-10-01" + "14:30" in Asia/Dhaka)
 * into the corresponding UTC instant. Returns null for malformed input.
 */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const [hh, mm] = timeStr.split(":").map(Number) as [number, number];
  if (hh > 23 || mm > 59) return null;
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  if (new Date(guess).toISOString().slice(0, 10) !== dateStr) return null;
  const first = guess - timeZoneOffsetMs(timeZone, new Date(guess));
  const second = guess - timeZoneOffsetMs(timeZone, new Date(first));
  return new Date(second);
}

/** Returns { date: "YYYY-MM-DD", time: "HH:mm" } for an instant in a time zone. */
export function utcToZonedParts(value: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
