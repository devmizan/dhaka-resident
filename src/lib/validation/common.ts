import { z } from "zod";
import { cleanText } from "@/lib/utils";
import { parseCalendarDate } from "@/lib/dates";

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null) return undefined;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const clean = (value: unknown) => (typeof value === "string" ? cleanText(value) : value);

/** Required free text, cleaned of control characters. */
export const text = (label: string, min: number, max: number) =>
  z.preprocess(
    clean,
    z
      .string({ error: `${label} is required` })
      .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
      .max(max, `${label} must be at most ${max} characters`),
  );

/** Optional free text; empty strings become undefined. */
export const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => emptyToUndefined(clean(value)),
    z.string().max(max, `${label} must be at most ${max} characters`).optional(),
  );

export const requiredInt = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min.toLocaleString("en-US")}`)
      .max(max, `${label} must be at most ${max.toLocaleString("en-US")}`),
  );

export const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min.toLocaleString("en-US")}`)
      .max(max, `${label} must be at most ${max.toLocaleString("en-US")}`)
      .optional(),
  );

export const optionalFloat = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number({ error: `${label} must be a number` }).min(min, `${label} is out of range`).max(max, `${label} is out of range`).optional(),
  );

export const optionalId = z.preprocess(emptyToUndefined, z.string().max(40).optional());

export const id = z.string().min(1).max(40);

/** "YYYY-MM-DD" string that parses to a real calendar date. */
export const calendarDate = (label: string) =>
  z.string({ error: `${label} is required` }).refine((value) => parseCalendarDate(value) !== null, `Enter a valid ${label.toLowerCase()}`);

export const optionalCalendarDate = (label: string) =>
  z.preprocess(emptyToUndefined, calendarDate(label).optional());

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");

export const idempotencyKey = z.uuid("Please reload the page and try again");

export const checkbox = z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean());

export const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());
