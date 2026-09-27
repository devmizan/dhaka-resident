"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CalendarClock, Flag, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors, FormAlert, FormField, useIdempotencyKey } from "@/components/forms/form-helpers";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import { enquirySchema, reportSchema, viewingRequestSchema } from "@/lib/validation/interactions";
import { reportListingAction, requestViewingAction, sendEnquiryAction } from "@/server/actions/interactions";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none md:text-sm";

export function EnquiryDialog({ propertyId, title, minDate }: { propertyId: string; title: string; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [key, rotateKey] = useIdempotencyKey();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      propertyId,
      idempotencyKey: key,
      message: `Hello, I'm interested in "${title}". Is it still available? I'd like to know more about `,
      moveInDate: "",
      occupants: "",
    },
  });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await sendEnquiryAction({ ...values, idempotencyKey: key });
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      return;
    }
    toast.success(result.message);
    setSentId(result.data.enquiryId);
    rotateKey();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSentId(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="emerald" size="lg" className="w-full">
          <MessageSquare data-icon="inline-start" />
          Send enquiry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send an enquiry</DialogTitle>
          <DialogDescription>Your message goes to the owner privately. An enquiry isn&apos;t a booking or a rental agreement.</DialogDescription>
        </DialogHeader>
        {sentId ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
              Your enquiry was sent. You&apos;ll get a notification when the owner replies.
            </p>
            <DialogFooter>
              <Button asChild variant="emerald">
                <Link href={`/dashboard/messages/${sentId}`}>Open conversation</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormAlert message={formError} />
            <FormField label="Message" required error={formState.errors.message?.message} description="10–2,000 characters. Don't share bank or card details.">
              {(p) => <Textarea {...p} rows={6} {...register("message")} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Preferred move-in date" error={formState.errors.moveInDate?.message}>
                {(p) => <Input {...p} type="date" min={minDate} {...register("moveInDate")} />}
              </FormField>
              <FormField label="Number of occupants" error={formState.errors.occupants?.message}>
                {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={50} {...register("occupants")} />}
              </FormField>
            </div>
            <DialogFooter>
              <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                Send enquiry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type SlotOption = { id: string; label: string };

export function ViewingDialog({ propertyId, slots, minDate, timeZoneLabel }: { propertyId: string; slots: SlotOption[]; minDate: string; timeZoneLabel: string }) {
  const [open, setOpen] = useState(false);
  const [key, rotateKey] = useIdempotencyKey();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<"slot" | "propose">(slots.length ? "slot" : "propose");
  const form = useForm({
    resolver: zodResolver(viewingRequestSchema),
    defaultValues: { propertyId, idempotencyKey: key, slotId: slots[0]?.id ?? "", date: "", time: "", note: "" },
  });
  const { register, handleSubmit, formState, setValue } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const payload = mode === "slot" ? { ...values, date: "", time: "" } : { ...values, slotId: "" };
    const result = await requestViewingAction({ ...payload, idempotencyKey: key });
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      return;
    }
    toast.success(result.message);
    rotateKey();
    setDone(true);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full">
          <CalendarClock data-icon="inline-start" />
          Request a viewing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a viewing</DialogTitle>
          <DialogDescription>The owner can accept or decline. A viewing request is not a booking or a rental agreement. Times are in {timeZoneLabel}.</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">Viewing requested. We&apos;ll notify you when the owner responds.</p>
            <DialogFooter>
              <Button asChild variant="emerald">
                <Link href="/dashboard/viewings">See my viewing requests</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormAlert message={formError} />
            {slots.length ? (
              <div role="radiogroup" aria-label="How do you want to choose a time?" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                {(["slot", "propose"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m);
                      setValue("slotId", m === "slot" ? (slots[0]?.id ?? "") : "");
                      if (m === "slot") {
                        setValue("date", "");
                        setValue("time", "");
                      }
                      form.clearErrors();
                    }}
                    className={`h-10 rounded-md text-sm font-semibold ${mode === m ? "bg-white text-navy-900 shadow-sm" : "text-muted-foreground"}`}
                  >
                    {m === "slot" ? "Offered times" : "Suggest a time"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">The owner hasn&apos;t offered specific times yet. Suggest a date and time that suits you.</p>
            )}

            {mode === "slot" && slots.length ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Choose a time</legend>
                <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
                  {slots.map((slot) => (
                    <label key={slot.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm has-checked:border-emerald-600 has-checked:bg-emerald-50">
                      <input type="radio" value={slot.id} className="size-5 accent-emerald-700" {...register("slotId")} />
                      {slot.label}
                    </label>
                  ))}
                </div>
                {formState.errors.slotId ? <p className="mt-1 text-sm text-red-700">{formState.errors.slotId.message}</p> : null}
              </fieldset>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Date" required error={formState.errors.date?.message ?? (mode === "propose" ? formState.errors.slotId?.message : undefined)}>
                  {(p) => <Input {...p} type="date" min={minDate} {...register("date")} />}
                </FormField>
                <FormField label="Time" required error={formState.errors.time?.message}>
                  {(p) => <Input {...p} type="time" step={900} {...register("time")} />}
                </FormField>
              </div>
            )}
            <FormField label="Note for the owner" error={formState.errors.note?.message}>
              {(p) => <Textarea {...p} rows={3} placeholder="e.g. I'll come with my family" {...register("note")} />}
            </FormField>
            <DialogFooter>
              <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                Send request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(reportSchema), defaultValues: { propertyId, reason: undefined, details: "" } });
  const { register, handleSubmit, formState, reset } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await reportListingAction(values);
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      return;
    }
    toast.success(result.message);
    reset();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-red-700">
          <Flag className="size-4" aria-hidden="true" />
          Report listing
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
          <DialogDescription>Reports are reviewed by our moderation team. The owner won&apos;t see who reported it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormAlert message={formError} />
          <FormField label="Reason" required error={formState.errors.reason?.message}>
            {(p) => (
              <select {...p} className={selectClass} defaultValue="" {...register("reason")}>
                <option value="" disabled>
                  Choose a reason
                </option>
                {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Details" required error={formState.errors.details?.message} description="What's wrong? Include anything that helps us check.">
            {(p) => <Textarea {...p} rows={4} {...register("details")} />}
          </FormField>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Submit report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
