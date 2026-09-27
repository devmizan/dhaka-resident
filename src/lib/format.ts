import type { BillingPeriod } from "@/generated/prisma/enums";
import { BILLING_PERIOD_SHORT } from "@/lib/labels";

/** Supported currencies. Add an entry here when launching in a new market. */
export const CURRENCIES: Record<string, { symbol: string; locale: string }> = {
  BDT: { symbol: "৳", locale: "en-IN" }, // en-IN gives lakh grouping (1,50,000), familiar in Bangladesh
};

export const DEFAULT_CURRENCY = "BDT";
export const DEFAULT_TIME_ZONE = "Asia/Dhaka";

export function formatMoney(amount: number | null | undefined, currencyCode = DEFAULT_CURRENCY): string {
  if (amount == null) return "—";
  const currency = CURRENCIES[currencyCode];
  if (!currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(amount);
  }
  return `${currency.symbol}${new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(amount)}`;
}

export function formatRent(amount: number | null | undefined, period: BillingPeriod, currencyCode = DEFAULT_CURRENCY, perBed = false) {
  return {
    amount: formatMoney(amount, currencyCode),
    suffix: `${perBed ? "/ bed " : ""}/ ${BILLING_PERIOD_SHORT[period]}`,
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Calendar dates (e.g. "available from") are stored at UTC midnight, so they are
 * formatted in UTC to avoid shifting the day.
 */
export function formatDate(value: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...options }).format(date);
}

/** Moments in time (messages, viewings) are formatted in the market's local time zone. */
export function formatDateTime(value: Date | string, timeZone = DEFAULT_TIME_ZONE, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
    ...options,
  }).format(date);
}

export function formatTime(value: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(date);
}

export function formatRelative(value: Date | string, now = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDate(date);
}

/** "Available now" or "Available from 1 Oct 2026". */
export function formatAvailability(availableFrom: Date | string | null | undefined, now = new Date()): string {
  if (!availableFrom) return "Availability on request";
  const date = typeof availableFrom === "string" ? new Date(availableFrom) : availableFrom;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() <= today) return "Available now";
  return `Available from ${formatDate(date, { year: date.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric" })}`;
}
