"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NamedIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import type { ActionResult } from "@/lib/action-result";
import {
  ADDRESS_VISIBILITY_LABELS,
  AMENITY_GROUP_LABELS,
  BATHROOM_TYPE_LABELS,
  BILLING_PERIOD_LABELS,
  FURNISHING_LABELS,
  PET_POLICY_LABELS,
  TENANT_PREFERENCE_LABELS,
} from "@/lib/labels";
import { amenitiesStepSchema, detailsStepSchema, locationStepSchema, pricingStepSchema, typeStepSchema, type ListingStepKey } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";
import { createDraftAction, saveListingStepAction } from "@/server/actions/listings";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none aria-invalid:border-destructive md:text-sm";

/** Shared submit handling: "Save draft" stays on the step, "Save & continue" moves to the next one. */
function useStepSubmit<T extends FieldValues>(form: UseFormReturn<T>, propertyId: string, step: ListingStepKey) {
  const [formError, setFormError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (values, event) => {
    setFormError(null);
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter as HTMLButtonElement | null | undefined;
    const intent = submitter?.value === "stay" ? "stay" : "continue";
    const result = (await saveListingStepAction(propertyId, step, values, intent)) as ActionResult<undefined> | undefined;
    if (!result) return;
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      toast.error(result.error);
      return;
    }
    toast.success("Draft saved");
  });
  return { onSubmit, formError };
}

function StepFooter({ submitting, continueLabel = "Save & continue" }: { submitting: boolean; continueLabel?: string }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col-reverse gap-2 border-t bg-white/95 px-5 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-b-2xl sm:px-0">
      <Button type="submit" name="intent" value="stay" variant="outline" disabled={submitting}>
        Save draft
      </Button>
      <Button type="submit" name="intent" value="continue" variant="emerald" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {continueLabel}
      </Button>
    </div>
  );
}

const str = (value: number | string | null | undefined) => (value === null || value === undefined ? "" : String(value));

// ─── Step 1: property type ───────────────────────────────────

type Category = { id: string; name: string; description: string | null; icon: string; usesRoomTypes: boolean };

export function TypeStepForm({ categories, propertyId, currentCategoryId }: { categories: Category[]; propertyId?: string; currentCategoryId?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(typeStepSchema), defaultValues: { categoryId: currentCategoryId ?? "" } });
  const { register, handleSubmit, formState, watch } = form;
  const selected = watch("categoryId");
  const current = categories.find((c) => c.id === currentCategoryId);
  const next = categories.find((c) => c.id === selected);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = propertyId ? await saveListingStepAction(propertyId, "type", values, "continue") : await createDraftAction(values);
    if (result && !result.ok) setFormError(applyActionErrors(form, result));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-navy-900">What are you listing?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-emerald-600/30",
                selected === category.id ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "hover:bg-navy-50",
              )}
            >
              <input type="radio" value={category.id} className="sr-only" {...register("categoryId")} />
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 ring-1 ring-border">
                <NamedIcon name={category.icon} className="size-5" />
              </span>
              <span>
                <span className="block font-semibold text-navy-900">{category.name}</span>
                <span className="block text-sm text-muted-foreground">{category.description}</span>
                {category.usesRoomTypes ? <span className="mt-1 block text-xs font-medium text-emerald-800">Let per bed, with room types</span> : null}
              </span>
            </label>
          ))}
        </div>
        {formState.errors.categoryId ? <p className="mt-2 text-sm text-red-700">{formState.errors.categoryId.message}</p> : null}
      </fieldset>
      {current?.usesRoomTypes && next && !next.usesRoomTypes ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Switching to {next.name} removes the room types you added.</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {propertyId ? "Save & continue" : "Start listing"}
        </Button>
      </div>
    </form>
  );
}

// ─── Step 2: location ────────────────────────────────────────

type CityOption = { id: string; name: string; country: { name: string }; neighborhoods: { id: string; name: string }[] };

export function LocationStepForm({
  propertyId,
  cities,
  defaults,
}: {
  propertyId: string;
  cities: CityOption[];
  defaults: { cityId: string | null; neighborhoodId: string | null; approximateArea: string | null; addressLine: string | null; latitude: number | null; longitude: number | null; addressVisibility: string };
}) {
  const form = useForm({
    resolver: zodResolver(locationStepSchema),
    defaultValues: {
      cityId: defaults.cityId ?? "",
      neighborhoodId: defaults.neighborhoodId ?? "",
      approximateArea: defaults.approximateArea ?? "",
      addressLine: defaults.addressLine ?? "",
      latitude: str(defaults.latitude),
      longitude: str(defaults.longitude),
      addressVisibility: defaults.addressVisibility as "PRIVATE",
    },
  });
  const { register, formState, watch, setValue } = form;
  const { onSubmit, formError } = useStepSubmit(form, propertyId, "location");
  const cityId = watch("cityId");
  const areas = cities.find((c) => c.id === cityId)?.neighborhoods ?? [];
  const e = formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="City" required error={e.cityId?.message}>
          {(p) => (
            <select {...p} className={selectClass} {...register("cityId", { onChange: () => setValue("neighborhoodId", "") })}>
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.country.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Neighbourhood / area" error={e.neighborhoodId?.message} description={cityId && !areas.length ? "No areas listed for this city yet." : undefined}>
          {(p) => (
            <select {...p} className={selectClass} disabled={!cityId || !areas.length} {...register("neighborhoodId")}>
              <option value="">{cityId ? "Choose an area" : "Choose a city first"}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>
      <FormField label="Nearby landmark or road (public)" error={e.approximateArea?.message} description="Shown on the listing, e.g. “Near Gulshan 2 Circle”.">
        {(p) => <Input {...p} {...register("approximateArea")} />}
      </FormField>
      <FormField label="Full address (private unless you choose otherwise)" error={e.addressLine?.message} description="House, road, block — helps tenants find the property after you agree to a viewing.">
        {(p) => <Input {...p} autoComplete="street-address" {...register("addressLine")} />}
      </FormField>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy-900">Who can see the full address?</legend>
        <div className="flex flex-col gap-2">
          {Object.entries(ADDRESS_VISIBILITY_LABELS).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-emerald-600 has-checked:bg-emerald-50">
              <input type="radio" value={value} className="size-5 accent-emerald-700" {...register("addressVisibility")} />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">The public map always shows only the approximate area (about 1 km).</p>
      </fieldset>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-semibold text-navy-900">Map coordinates (optional)</summary>
        <p className="mt-2 text-xs text-muted-foreground">Used to centre the approximate-area map. If left empty, the area&apos;s centre is used.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <FormField label="Latitude" error={e.latitude?.message}>
            {(p) => <Input {...p} inputMode="decimal" placeholder="23.7925" {...register("latitude")} />}
          </FormField>
          <FormField label="Longitude" error={e.longitude?.message}>
            {(p) => <Input {...p} inputMode="decimal" placeholder="90.4155" {...register("longitude")} />}
          </FormField>
        </div>
      </details>
      <StepFooter submitting={formState.isSubmitting} />
    </form>
  );
}

// ─── Step 3: details (+ room types for hostels/shared rooms) ─

type RoomDefaults = { id: string; name: string; bedsPerRoom: number; totalBeds: number; availableBeds: number; pricePerBed: number; billingPeriod: string; bathroomType: string; description: string | null };

export function DetailsStepForm({
  propertyId,
  usesRoomTypes,
  isCommercial,
  defaults,
}: {
  propertyId: string;
  usesRoomTypes: boolean;
  isCommercial: boolean;
  defaults: {
    title: string;
    description: string;
    bedrooms: number | null;
    bathrooms: number | null;
    floorAreaSqft: number | null;
    floorNumber: number | null;
    totalFloors: number | null;
    furnishing: string | null;
    bathroomType: string | null;
    availableFrom: string;
    minimumStay: number | null;
    tenantPreference: string;
    includedFacilities: string | null;
    roomTypes: RoomDefaults[];
  };
}) {
  const form = useForm({
    resolver: zodResolver(detailsStepSchema),
    defaultValues: {
      title: defaults.title,
      description: defaults.description,
      bedrooms: str(defaults.bedrooms),
      bathrooms: str(defaults.bathrooms),
      floorAreaSqft: str(defaults.floorAreaSqft),
      floorNumber: str(defaults.floorNumber),
      totalFloors: str(defaults.totalFloors),
      furnishing: defaults.furnishing ?? "",
      bathroomType: defaults.bathroomType ?? "",
      availableFrom: defaults.availableFrom,
      minimumStay: str(defaults.minimumStay),
      tenantPreference: defaults.tenantPreference as "ANY",
      includedFacilities: defaults.includedFacilities ?? "",
      roomTypes: defaults.roomTypes.map((r) => ({ ...r, description: r.description ?? "" })) as never[],
    },
  });
  const { register, formState, control } = form;
  const rooms = useFieldArray({ control, name: "roomTypes" as never });
  const { onSubmit, formError } = useStepSubmit(form, propertyId, "details");
  const e = formState.errors;
  const roomErrors = (e.roomTypes as unknown as Record<string, Record<string, { message?: string }>> | undefined) ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <FormField label="Listing title" required error={e.title?.message} description="10–120 characters. Mention the type, size and a key feature.">
        {(p) => <Input {...p} maxLength={120} {...register("title")} />}
      </FormField>
      <FormField label="Description" required error={e.description?.message} description="At least 50 characters. Describe the rooms, building, neighbourhood and who it suits.">
        {(p) => <Textarea {...p} rows={8} maxLength={5000} {...register("description")} />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        {!usesRoomTypes && !isCommercial ? (
          <FormField label="Bedrooms" error={e.bedrooms?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={0} {...register("bedrooms")} />}
          </FormField>
        ) : null}
        <FormField label={usesRoomTypes ? "Bathrooms (total)" : "Bathrooms"} error={e.bathrooms?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} {...register("bathrooms")} />}
        </FormField>
        <FormField label="Floor area (sq ft)" error={e.floorAreaSqft?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} {...register("floorAreaSqft")} />}
        </FormField>
        <FormField label="Floor" error={e.floorNumber?.message} description="0 for ground floor">
          {(p) => <Input {...p} type="number" inputMode="numeric" {...register("floorNumber")} />}
        </FormField>
        <FormField label="Total floors in building" error={e.totalFloors?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} {...register("totalFloors")} />}
        </FormField>
        <FormField label="Furnishing" error={e.furnishing?.message}>
          {(p) => (
            <select {...p} className={selectClass} {...register("furnishing")}>
              <option value="">Not specified</option>
              {Object.entries(FURNISHING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {!usesRoomTypes ? (
          <FormField label="Bathroom" error={e.bathroomType?.message}>
            {(p) => (
              <select {...p} className={selectClass} {...register("bathroomType")}>
                <option value="">Not specified</option>
                {Object.entries(BATHROOM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        ) : null}
        <FormField label="Available from" required error={e.availableFrom?.message}>
          {(p) => <Input {...p} type="date" {...register("availableFrom")} />}
        </FormField>
        <FormField label="Minimum stay" error={e.minimumStay?.message} description="In billing periods, e.g. 12 months or 2 days">
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} {...register("minimumStay")} />}
        </FormField>
      </div>

      <FormField label="Suitable for" error={e.tenantPreference?.message}>
        {(p) => (
          <select {...p} className={selectClass} {...register("tenantPreference")}>
            {Object.entries(TENANT_PREFERENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {usesRoomTypes ? (
        <section className="rounded-2xl border bg-navy-50/50 p-4 sm:p-5" aria-labelledby="rooms-heading">
          <h3 id="rooms-heading" className="font-bold">
            Room types and beds
          </h3>
          <p className="text-sm text-muted-foreground">Add each kind of room you offer. The lowest bed price is shown in search results.</p>
          {e.roomTypes?.message || e.roomTypes?.root?.message ? <p className="mt-2 text-sm text-red-700">{e.roomTypes?.message ?? e.roomTypes?.root?.message}</p> : null}
          <ol className="mt-4 flex flex-col gap-4">
            {rooms.fields.map((field, index) => {
              const re = roomErrors[index] ?? {};
              return (
                <li key={field.id} className="rounded-xl border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Room type {index + 1}</p>
                    <Button type="button" variant="ghost" size="sm" className="text-red-700" onClick={() => rooms.remove(index)}>
                      <Trash2 data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                  <input type="hidden" {...register(`roomTypes.${index}.id` as const)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label="Name" required error={re.name?.message} className="sm:col-span-3">
                      {(p) => <Input {...p} placeholder="e.g. 4-bed dorm" {...register(`roomTypes.${index}.name` as const)} />}
                    </FormField>
                    <FormField label="Beds per room" required error={re.bedsPerRoom?.message}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={1} {...register(`roomTypes.${index}.bedsPerRoom` as const)} />}
                    </FormField>
                    <FormField label="Total beds" required error={re.totalBeds?.message}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={1} {...register(`roomTypes.${index}.totalBeds` as const)} />}
                    </FormField>
                    <FormField label="Available beds" required error={re.availableBeds?.message}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={0} {...register(`roomTypes.${index}.availableBeds` as const)} />}
                    </FormField>
                    <FormField label="Price per bed (৳)" required error={re.pricePerBed?.message}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={100} {...register(`roomTypes.${index}.pricePerBed` as const)} />}
                    </FormField>
                    <FormField label="Billed" error={re.billingPeriod?.message}>
                      {(p) => (
                        <select {...p} className={selectClass} {...register(`roomTypes.${index}.billingPeriod` as const)}>
                          {Object.entries(BILLING_PERIOD_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>
                    <FormField label="Bathroom" error={re.bathroomType?.message}>
                      {(p) => (
                        <select {...p} className={selectClass} {...register(`roomTypes.${index}.bathroomType` as const)}>
                          <option value="SHARED">Shared</option>
                          <option value="PRIVATE">Private</option>
                        </select>
                      )}
                    </FormField>
                    <FormField label="Short description" error={re.description?.message} className="sm:col-span-3">
                      {(p) => <Input {...p} maxLength={300} {...register(`roomTypes.${index}.description` as const)} />}
                    </FormField>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={rooms.fields.length >= 20}
            onClick={() => rooms.append({ id: "", name: "", bedsPerRoom: "", totalBeds: "", availableBeds: "", pricePerBed: "", billingPeriod: "MONTHLY", bathroomType: "SHARED", description: "" } as never)}
          >
            <Plus data-icon="inline-start" />
            Add room type
          </Button>
          <div className="mt-5">
            <FormField label="Included facilities" error={e.includedFacilities?.message} description="e.g. meals, laundry, cleaning, study room">
              {(p) => <Textarea {...p} rows={3} {...register("includedFacilities")} />}
            </FormField>
          </div>
        </section>
      ) : null}

      <StepFooter submitting={formState.isSubmitting} />
    </form>
  );
}

// ─── Step 4: pricing ─────────────────────────────────────────

export function PricingStepForm({
  propertyId,
  usesRoomTypes,
  roomPriceSummary,
  defaults,
}: {
  propertyId: string;
  usesRoomTypes: boolean;
  roomPriceSummary: string | null;
  defaults: { rentAmount: number | null; billingPeriod: string; rentNegotiable: boolean; securityDeposit: number | null; advanceRentMonths: number | null; serviceCharge: number | null; utilitiesIncluded: boolean; utilitiesNote: string | null; otherFees: string | null };
}) {
  const form = useForm({
    resolver: zodResolver(pricingStepSchema),
    defaultValues: {
      rentAmount: str(defaults.rentAmount),
      billingPeriod: defaults.billingPeriod as "MONTHLY",
      rentNegotiable: defaults.rentNegotiable,
      securityDeposit: str(defaults.securityDeposit),
      advanceRentMonths: str(defaults.advanceRentMonths),
      serviceCharge: str(defaults.serviceCharge),
      utilitiesIncluded: defaults.utilitiesIncluded,
      utilitiesNote: defaults.utilitiesNote ?? "",
      otherFees: defaults.otherFees ?? "",
    },
  });
  const { register, formState } = form;
  const { onSubmit, formError } = useStepSubmit(form, propertyId, "pricing");
  const e = formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      {usesRoomTypes ? (
        <div className="rounded-xl bg-navy-50 p-4 text-sm text-navy-900">
          <p className="font-semibold">Bed prices come from your room types</p>
          <p className="mt-1">{roomPriceSummary ?? "Add room types in the Details step to set bed prices."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Rent (৳)" required error={e.rentAmount?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={100} step={100} {...register("rentAmount")} />}
          </FormField>
          <FormField label="Billing period" error={e.billingPeriod?.message}>
            {(p) => (
              <select {...p} className={selectClass} {...register("billingPeriod")}>
                {Object.entries(BILLING_PERIOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      )}
      {!usesRoomTypes ? (
        <label className="flex items-center gap-3 text-sm text-navy-800">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("rentNegotiable")} />
          Rent is negotiable
        </label>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Security deposit (৳)" error={e.securityDeposit?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={100} {...register("securityDeposit")} />}
        </FormField>
        <FormField label="Advance rent (months)" error={e.advanceRentMonths?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={24} {...register("advanceRentMonths")} />}
        </FormField>
        <FormField label="Monthly service charge (৳)" error={e.serviceCharge?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={100} {...register("serviceCharge")} />}
        </FormField>
      </div>
      <label className="flex items-center gap-3 text-sm text-navy-800">
        <input type="checkbox" className="size-5 accent-emerald-700" {...register("utilitiesIncluded")} />
        Utilities are included in the rent
      </label>
      <FormField label="Utilities details" error={e.utilitiesNote?.message} description="e.g. prepaid electricity meter, fixed gas bill">
        {(p) => <Input {...p} maxLength={300} {...register("utilitiesNote")} />}
      </FormField>
      <FormField label="Other fees" error={e.otherFees?.message} description="List any other charges clearly so tenants aren't surprised.">
        {(p) => <Textarea {...p} rows={3} maxLength={500} {...register("otherFees")} />}
      </FormField>
      <StepFooter submitting={formState.isSubmitting} />
    </form>
  );
}

// ─── Step 5: amenities & rules ───────────────────────────────

type AmenityOption = { id: string; name: string; group: keyof typeof AMENITY_GROUP_LABELS; icon: string };

export function AmenitiesStepForm({
  propertyId,
  amenities,
  defaults,
}: {
  propertyId: string;
  amenities: AmenityOption[];
  defaults: { amenityIds: string[]; petPolicy: string; smokingAllowed: boolean; houseRules: string | null };
}) {
  const form = useForm({
    resolver: zodResolver(amenitiesStepSchema),
    defaultValues: { amenityIds: defaults.amenityIds, petPolicy: defaults.petPolicy as "NOT_ALLOWED", smokingAllowed: defaults.smokingAllowed, houseRules: defaults.houseRules ?? "" },
  });
  const { register, formState } = form;
  const { onSubmit, formError } = useStepSubmit(form, propertyId, "amenities");
  const e = formState.errors;
  const groups = Object.keys(AMENITY_GROUP_LABELS) as (keyof typeof AMENITY_GROUP_LABELS)[];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormAlert message={formError} />
      {groups.map((group) => {
        const items = amenities.filter((a) => a.group === group);
        if (!items.length) return null;
        return (
          <fieldset key={group}>
            <legend className="mb-2 text-sm font-semibold text-navy-900">{AMENITY_GROUP_LABELS[group]}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((amenity) => (
                <label key={amenity.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-emerald-600 has-checked:bg-emerald-50">
                  <input type="checkbox" value={amenity.id} className="size-5 accent-emerald-700" {...register("amenityIds")} />
                  <NamedIcon name={amenity.icon} className="size-4 text-navy-500" />
                  {amenity.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Pet policy" error={e.petPolicy?.message}>
          {(p) => (
            <select {...p} className={selectClass} {...register("petPolicy")}>
              {Object.entries(PET_POLICY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <label className="flex items-center gap-3 self-end pb-2 text-sm text-navy-800">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("smokingAllowed")} />
          Smoking is allowed
        </label>
      </div>
      <FormField label="House rules" error={e.houseRules?.message} description="One rule per line, e.g. visiting hours, gate closing time.">
        {(p) => <Textarea {...p} rows={5} maxLength={2000} {...register("houseRules")} />}
      </FormField>
      <p className="text-xs text-muted-foreground">Rules must not discriminate on religion, ethnicity or disability.</p>
      <StepFooter submitting={formState.isSubmitting} />
    </form>
  );
}
