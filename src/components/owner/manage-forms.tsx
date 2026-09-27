"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import { availabilitySchema } from "@/lib/validation/listing";
import { viewingSlotSchema } from "@/lib/validation/interactions";
import { cancelViewingSlotAction, createViewingSlotAction, updateAvailabilityAction } from "@/server/actions/listings";

type Room = { id: string; name: string; totalBeds: number; availableBeds: number };

export function AvailabilityForm({ propertyId, availableFrom, rooms }: { propertyId: string; availableFrom: string; rooms: Room[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { availableFrom, rooms: rooms.map((r) => ({ id: r.id, availableBeds: String(r.availableBeds) })) },
  });
  const { register, handleSubmit, formState } = form;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await updateAvailabilityAction(propertyId, values);
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    toast.success(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField label="Available from" error={formState.errors.availableFrom?.message}>
        {(p) => <Input {...p} type="date" className="sm:max-w-xs" {...register("availableFrom")} />}
      </FormField>
      {rooms.length ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy-900">Available beds by room type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room, index) => (
              <FormField key={room.id} label={`${room.name} (of ${room.totalBeds})`} error={formState.errors.rooms?.[index]?.availableBeds?.message}>
                {(p) => (
                  <>
                    <input type="hidden" {...register(`rooms.${index}.id`)} />
                    <Input {...p} type="number" inputMode="numeric" min={0} max={room.totalBeds} {...register(`rooms.${index}.availableBeds`)} />
                  </>
                )}
              </FormField>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div>
        <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Update availability
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Availability updates go live immediately and don&apos;t require re-approval.</p>
    </form>
  );
}

export function ViewingSlotForm({ propertyId, minDate }: { propertyId: string; minDate: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(viewingSlotSchema), defaultValues: { propertyId, date: "", startTime: "11:00", durationMinutes: "30", note: "" } });
  const { register, handleSubmit, formState, reset } = form;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createViewingSlotAction(values);
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    toast.success(result.message);
    reset({ propertyId, date: values.date, startTime: values.startTime, durationMinutes: String(values.durationMinutes), note: "" });
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Date" required error={formState.errors.date?.message}>
          {(p) => <Input {...p} type="date" min={minDate} {...register("date")} />}
        </FormField>
        <FormField label="Start time" required error={formState.errors.startTime?.message}>
          {(p) => <Input {...p} type="time" step={900} {...register("startTime")} />}
        </FormField>
        <FormField label="Duration" error={formState.errors.durationMinutes?.message}>
          {(p) => (
            <select {...p} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-base md:text-sm" {...register("durationMinutes")}>
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>
      <FormField label="Note for tenants" error={formState.errors.note?.message}>
        {(p) => <Input {...p} maxLength={200} placeholder="e.g. Ask the guard for Flat 6B" {...register("note")} />}
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
          Offer this time
        </Button>
      </div>
    </form>
  );
}

export function CancelSlotButton({ slotId, hasRequests }: { slotId: string; hasRequests: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-700"
      disabled={pending}
      onClick={() => {
        if (hasRequests && !window.confirm("Tenants have requested this time. Remove it and notify them?")) return;
        startTransition(async () => {
          const result = await cancelViewingSlotAction(slotId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <X data-icon="inline-start" />}
      Remove
    </Button>
  );
}
