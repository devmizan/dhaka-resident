import { z } from "zod";
import { ReportReason } from "@/generated/prisma/enums";
import {
  calendarDate,
  id,
  idempotencyKey,
  optionalCalendarDate,
  optionalInt,
  optionalText,
  requiredInt,
  text,
  timeOfDay,
} from "@/lib/validation/common";

export const enquirySchema = z.object({
  propertyId: id,
  message: text("Message", 10, 2000),
  moveInDate: optionalCalendarDate("Move-in date"),
  occupants: optionalInt("Number of occupants", 1, 50),
  idempotencyKey,
});

export const messageSchema = z.object({
  enquiryId: id,
  body: text("Message", 1, 2000),
  idempotencyKey,
});

export const viewingRequestSchema = z
  .object({
    propertyId: id,
    slotId: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
    date: optionalCalendarDate("Date"),
    time: z.preprocess((v) => (v === "" ? undefined : v), timeOfDay.optional()),
    note: optionalText("Note", 500),
    idempotencyKey,
  })
  .refine((data) => Boolean(data.slotId) || (Boolean(data.date) && Boolean(data.time)), {
    path: ["slotId"],
    message: "Choose one of the offered times or suggest a date and time",
  });

export const viewingDecisionSchema = z.object({
  viewingId: id,
  note: optionalText("Note", 500),
});

export const viewingSlotSchema = z.object({
  propertyId: id,
  date: calendarDate("Date"),
  startTime: timeOfDay,
  durationMinutes: requiredInt("Duration", 15, 240),
  note: optionalText("Note", 200),
});

export const reportSchema = z.object({
  propertyId: id,
  reason: z.enum(ReportReason, "Choose a reason"),
  details: text("Details", 10, 1000),
});

export type EnquiryInput = z.input<typeof enquirySchema>;
export type ViewingRequestInput = z.input<typeof viewingRequestSchema>;
