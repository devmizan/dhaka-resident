"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ICON_NAMES, NamedIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import type { ActionResult } from "@/lib/action-result";
import { AMENITY_GROUP_LABELS } from "@/lib/labels";
import { amenitySchema, categorySchema, citySchema, countrySchema, neighborhoodSchema, siteSettingsSchema } from "@/lib/validation/admin";
import { createCountryAction, saveAmenityAction, saveCategoryAction, saveCityAction, saveNeighborhoodAction, updateSiteSettingsAction } from "@/server/actions/admin";

const selectClass = "h-10 w-full rounded-lg border border-input bg-white px-3 text-base md:text-sm";

function useSave<T extends FieldValues>(form: UseFormReturn<T>, action: (values: T) => Promise<ActionResult<unknown>>, onDone: () => void) {
  const [formError, setFormError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values);
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    toast.success(result.message);
    onDone();
  });
  return { onSubmit, formError };
}

function FormDialog({ title, description, trigger, children, open, setOpen }: { title: string; description?: string; trigger: React.ReactNode; children: React.ReactNode; open: boolean; setOpen: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function SubmitRow({ submitting, label = "Save" }: { submitting: boolean; label?: string }) {
  return (
    <DialogFooter>
      <Button type="submit" variant="emerald" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {label}
      </Button>
    </DialogFooter>
  );
}

const EditTrigger = ({ label }: { label: string }) => (
  <Button variant="ghost" size="icon-sm" aria-label={label}>
    <Pencil />
  </Button>
);

const AddTrigger = ({ label }: { label: string }) => (
  <Button variant="outline" size="sm">
    <Plus data-icon="inline-start" />
    {label}
  </Button>
);

export function CountryForm() {
  const [open, setOpen] = useState(false);
  const form = useForm({ resolver: zodResolver(countrySchema), defaultValues: { code: "", name: "", currencyCode: "", currencySymbol: "", timeZone: "" } });
  const { register, formState, reset } = form;
  const { onSubmit, formError } = useSave(form, createCountryAction, () => {
    reset();
    setOpen(false);
  });
  const e = formState.errors;
  return (
    <FormDialog title="Add a country" description="Prepare a new market. Add its currency to src/lib/format.ts for local number formatting." trigger={<AddTrigger label="Add country" />} open={open} setOpen={setOpen}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Country name" required error={e.name?.message}>
            {(p) => <Input {...p} {...register("name")} />}
          </FormField>
          <FormField label="ISO code" required error={e.code?.message} description="e.g. NP">
            {(p) => <Input {...p} maxLength={2} {...register("code")} />}
          </FormField>
          <FormField label="Currency code" required error={e.currencyCode?.message} description="e.g. NPR">
            {(p) => <Input {...p} maxLength={3} {...register("currencyCode")} />}
          </FormField>
          <FormField label="Currency symbol" required error={e.currencySymbol?.message}>
            {(p) => <Input {...p} maxLength={5} {...register("currencySymbol")} />}
          </FormField>
        </div>
        <FormField label="Time zone" required error={e.timeZone?.message} description="IANA name, e.g. Asia/Kathmandu">
          {(p) => <Input {...p} {...register("timeZone")} />}
        </FormField>
        <SubmitRow submitting={formState.isSubmitting} label="Add country" />
      </form>
    </FormDialog>
  );
}

type CityDefaults = { id?: string; countryId: string; name: string; slug: string; sortOrder: number; isActive: boolean; latitude: number | null; longitude: number | null };

export function CityForm({ countries, city }: { countries: { id: string; name: string }[]; city?: CityDefaults }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(citySchema),
    defaultValues: {
      id: city?.id,
      countryId: city?.countryId ?? countries[0]?.id ?? "",
      name: city?.name ?? "",
      slug: city?.slug ?? "",
      sortOrder: String(city?.sortOrder ?? 100),
      isActive: city?.isActive ?? true,
      latitude: city?.latitude == null ? "" : String(city.latitude),
      longitude: city?.longitude == null ? "" : String(city.longitude),
    },
  });
  const { register, formState, reset } = form;
  const { onSubmit, formError } = useSave(form, saveCityAction, () => {
    if (!city) reset();
    setOpen(false);
  });
  const e = formState.errors;
  return (
    <FormDialog title={city ? `Edit ${city.name}` : "Add a city"} trigger={city ? <EditTrigger label={`Edit ${city.name}`} /> : <AddTrigger label="Add city" />} open={open} setOpen={setOpen}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <FormField label="Country" required error={e.countryId?.message}>
          {(p) => (
            <select {...p} className={selectClass} {...register("countryId")}>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City name" required error={e.name?.message}>
            {(p) => <Input {...p} {...register("name")} />}
          </FormField>
          <FormField label="URL slug" error={e.slug?.message} description="Leave empty to generate">
            {(p) => <Input {...p} {...register("slug")} />}
          </FormField>
          <FormField label="Latitude" error={e.latitude?.message}>
            {(p) => <Input {...p} inputMode="decimal" {...register("latitude")} />}
          </FormField>
          <FormField label="Longitude" error={e.longitude?.message}>
            {(p) => <Input {...p} inputMode="decimal" {...register("longitude")} />}
          </FormField>
          <FormField label="Sort order" error={e.sortOrder?.message}>
            {(p) => <Input {...p} type="number" {...register("sortOrder")} />}
          </FormField>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("isActive")} />
          Active (available in search and for new listings)
        </label>
        <SubmitRow submitting={formState.isSubmitting} />
      </form>
    </FormDialog>
  );
}

export function NeighborhoodForm({ cityId, cityName, area }: { cityId: string; cityName: string; area?: { id: string; name: string; slug: string; isActive: boolean } }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(neighborhoodSchema),
    defaultValues: { id: area?.id, cityId, name: area?.name ?? "", slug: area?.slug ?? "", isActive: area?.isActive ?? true },
  });
  const { register, formState, reset } = form;
  const { onSubmit, formError } = useSave(form, saveNeighborhoodAction, () => {
    if (!area) reset({ cityId, name: "", slug: "", isActive: true });
    setOpen(false);
  });
  const e = formState.errors;
  return (
    <FormDialog
      title={area ? `Edit ${area.name}` : `Add an area in ${cityName}`}
      trigger={
        area ? (
          <button type="button" className="rounded-full px-2 py-1 text-xs text-navy-700 hover:bg-navy-100" aria-label={`Edit ${area.name}`}>
            <Pencil className="size-3" />
          </button>
        ) : (
          <Button variant="ghost" size="sm">
            <Plus data-icon="inline-start" />
            Add area
          </Button>
        )
      }
      open={open}
      setOpen={setOpen}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Area name" required error={e.name?.message}>
            {(p) => <Input {...p} {...register("name")} />}
          </FormField>
          <FormField label="URL slug" error={e.slug?.message} description="Leave empty to generate">
            {(p) => <Input {...p} {...register("slug")} />}
          </FormField>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("isActive")} />
          Active
        </label>
        <SubmitRow submitting={formState.isSubmitting} />
      </form>
    </FormDialog>
  );
}

function IconSelect(props: React.ComponentProps<"select">) {
  return (
    <select {...props} className={selectClass}>
      {ICON_NAMES.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

type CategoryDefaults = { id: string; name: string; pluralName: string; slug: string; description: string | null; icon: string; usesRoomTypes: boolean; isCommercial: boolean; isActive: boolean; sortOrder: number };

export function CategoryForm({ category }: { category?: CategoryDefaults }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      id: category?.id,
      name: category?.name ?? "",
      pluralName: category?.pluralName ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "house",
      usesRoomTypes: category?.usesRoomTypes ?? false,
      isCommercial: category?.isCommercial ?? false,
      isActive: category?.isActive ?? true,
      sortOrder: String(category?.sortOrder ?? 100),
    },
  });
  const { register, formState, reset, watch } = form;
  const { onSubmit, formError } = useSave(form, saveCategoryAction, () => {
    if (!category) reset();
    setOpen(false);
  });
  const e = formState.errors;
  return (
    <FormDialog title={category ? `Edit ${category.name}` : "Add a property category"} trigger={category ? <EditTrigger label={`Edit ${category.name}`} /> : <AddTrigger label="Add category" />} open={open} setOpen={setOpen}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={e.name?.message}>
            {(p) => <Input {...p} {...register("name")} />}
          </FormField>
          <FormField label="Plural name" required error={e.pluralName?.message}>
            {(p) => <Input {...p} {...register("pluralName")} />}
          </FormField>
          <FormField label="URL slug" error={e.slug?.message} description="Leave empty to generate">
            {(p) => <Input {...p} {...register("slug")} />}
          </FormField>
          <FormField label="Sort order" error={e.sortOrder?.message}>
            {(p) => <Input {...p} type="number" {...register("sortOrder")} />}
          </FormField>
        </div>
        <FormField label="Description" error={e.description?.message}>
          {(p) => <Input {...p} {...register("description")} />}
        </FormField>
        <FormField label="Icon" error={e.icon?.message}>
          {(p) => (
            <div className="flex items-center gap-3">
              <NamedIcon name={watch("icon")} className="size-6 text-emerald-700" />
              <IconSelect {...p} {...register("icon")} />
            </div>
          )}
        </FormField>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("usesRoomTypes")} />
          Let per bed with room types (hostels, shared rooms)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("isCommercial")} />
          Commercial category
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("isActive")} />
          Active
        </label>
        <SubmitRow submitting={formState.isSubmitting} />
      </form>
    </FormDialog>
  );
}

type AmenityDefaults = { id: string; name: string; slug: string; group: keyof typeof AMENITY_GROUP_LABELS; icon: string; isActive: boolean; sortOrder: number };

export function AmenityForm({ amenity }: { amenity?: AmenityDefaults }) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(amenitySchema),
    defaultValues: {
      id: amenity?.id,
      name: amenity?.name ?? "",
      slug: amenity?.slug ?? "",
      group: amenity?.group ?? "ESSENTIALS",
      icon: amenity?.icon ?? "check",
      isActive: amenity?.isActive ?? true,
      sortOrder: String(amenity?.sortOrder ?? 100),
    },
  });
  const { register, formState, reset, watch } = form;
  const { onSubmit, formError } = useSave(form, saveAmenityAction, () => {
    if (!amenity) reset();
    setOpen(false);
  });
  const e = formState.errors;
  return (
    <FormDialog title={amenity ? `Edit ${amenity.name}` : "Add an amenity"} trigger={amenity ? <EditTrigger label={`Edit ${amenity.name}`} /> : <AddTrigger label="Add amenity" />} open={open} setOpen={setOpen}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={e.name?.message}>
            {(p) => <Input {...p} {...register("name")} />}
          </FormField>
          <FormField label="URL slug" error={e.slug?.message} description="Used in search URLs">
            {(p) => <Input {...p} {...register("slug")} />}
          </FormField>
          <FormField label="Group" error={e.group?.message}>
            {(p) => (
              <select {...p} className={selectClass} {...register("group")}>
                {Object.entries(AMENITY_GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Sort order" error={e.sortOrder?.message}>
            {(p) => <Input {...p} type="number" {...register("sortOrder")} />}
          </FormField>
        </div>
        <FormField label="Icon" error={e.icon?.message}>
          {(p) => (
            <div className="flex items-center gap-3">
              <NamedIcon name={watch("icon")} className="size-6 text-emerald-700" />
              <IconSelect {...p} {...register("icon")} />
            </div>
          )}
        </FormField>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" {...register("isActive")} />
          Active
        </label>
        <SubmitRow submitting={formState.isSubmitting} />
      </form>
    </FormDialog>
  );
}

export function SiteSettingsForm({ defaults }: { defaults: { contactEmail: string; contactPhone?: string; officeAddress?: string; announcement?: string } }) {
  const form = useForm({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: { contactEmail: defaults.contactEmail, contactPhone: defaults.contactPhone ?? "", officeAddress: defaults.officeAddress ?? "", announcement: defaults.announcement ?? "" },
  });
  const { register, formState } = form;
  const { onSubmit, formError } = useSave(form, updateSiteSettingsAction, () => undefined);
  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Support email" required error={e.contactEmail?.message} description="Shown in the footer and contact page.">
          {(p) => <Input {...p} type="email" {...register("contactEmail")} />}
        </FormField>
        <FormField label="Support phone" error={e.contactPhone?.message}>
          {(p) => <Input {...p} type="tel" {...register("contactPhone")} />}
        </FormField>
      </div>
      <FormField label="Office address" error={e.officeAddress?.message}>
        {(p) => <Input {...p} {...register("officeAddress")} />}
      </FormField>
      <FormField label="Site-wide announcement" error={e.announcement?.message} description="Optional banner shown above the header on every page. Leave empty to hide.">
        {(p) => <Input {...p} maxLength={240} {...register("announcement")} />}
      </FormField>
      <div>
        <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Save settings
        </Button>
      </div>
    </form>
  );
}
