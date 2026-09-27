"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import { changePasswordSchema, notificationPreferencesSchema, phoneUpdateSchema, profileSchema } from "@/lib/validation/auth";
import { changePasswordAction, updateNotificationPreferencesAction, updatePhoneAction, updateProfileAction } from "@/server/actions/auth";

export function PhoneForm({ phone }: { phone: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(phoneUpdateSchema), defaultValues: { phone } });
  const { register, handleSubmit, formState } = form;
  return (
    <form
      onSubmit={handleSubmit(async () => {
        setFormError(null);
        const result = await updatePhoneAction(form.getValues());
        if (!result.ok) return setFormError(applyActionErrors(form, result));
        toast.success(result.message);
      })}
      className="flex flex-col gap-3"
      noValidate
    >
      <FormAlert message={formError} />
      <FormField label="Mobile number" error={formState.errors.phone?.message} description="Not shown on listings.">
        {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="01712-345678" className="sm:max-w-xs" {...register("phone")} />}
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Save number
        </Button>
      </div>
    </form>
  );
}

export function ProfileForm({ defaults, isOwner }: { defaults: { name: string; companyName: string; bio: string }; isOwner: boolean }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { register, handleSubmit, formState } = form;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await updateProfileAction(values);
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    toast.success(result.message);
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField label="Full name" required error={formState.errors.name?.message} className="sm:max-w-md">
        {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
      </FormField>
      {isOwner ? (
        <FormField label="Company or brand name" error={formState.errors.companyName?.message} description="Shown on your listings instead of your personal name, if set.">
          {(p) => <Input {...p} {...register("companyName")} />}
        </FormField>
      ) : null}
      <FormField label="About you" error={formState.errors.bio?.message} description={isOwner ? "Shown on your listings." : "Visible to owners you contact."}>
        {(p) => <Textarea {...p} rows={4} {...register("bio")} />}
      </FormField>
      <div>
        <Button type="submit" variant="emerald" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const { register, handleSubmit, formState, reset } = form;
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await changePasswordAction(values);
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    toast.success(result.message);
    reset();
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField label="Current password" error={formState.errors.currentPassword?.message}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("currentPassword")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="New password" error={formState.errors.newPassword?.message} description="At least 10 characters with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("newPassword")} />}
        </FormField>
        <FormField label="Confirm new password" error={formState.errors.confirmPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("confirmPassword")} />}
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Change password
        </Button>
      </div>
    </form>
  );
}

const PREFS = [
  { name: "emailNotifications", label: "Email me copies of notifications", description: "Master switch for all emails below." },
  { name: "notifyEnquiries", label: "Enquiries and messages", description: "New enquiries and replies." },
  { name: "notifyViewings", label: "Viewing requests", description: "Requests, acceptances, declines and cancellations." },
  { name: "notifyListing", label: "Listings and reports", description: "Approvals, requested changes and report outcomes." },
] as const;

export function NotificationPreferencesForm({ defaults }: { defaults: { emailNotifications: boolean; notifyEnquiries: boolean; notifyViewings: boolean; notifyListing: boolean } }) {
  const form = useForm({ resolver: zodResolver(notificationPreferencesSchema), defaultValues: defaults });
  const { control, handleSubmit, formState, watch } = form;
  const master = watch("emailNotifications");
  const onSubmit = handleSubmit(async (values) => {
    const result = await updateNotificationPreferencesAction(values);
    if (!result.ok) toast.error(result.error);
    else toast.success(result.message);
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <ul className="divide-y rounded-xl border">
        {PREFS.map((pref) => (
          <li key={pref.name} className="flex items-center justify-between gap-4 p-4">
            <label htmlFor={pref.name} className="min-w-0">
              <span className="block text-sm font-medium text-navy-900">{pref.label}</span>
              <span className="block text-xs text-muted-foreground">{pref.description}</span>
            </label>
            <Controller
              control={control}
              name={pref.name}
              render={({ field }) => (
                <Switch id={pref.name} checked={field.value} onCheckedChange={field.onChange} disabled={pref.name !== "emailNotifications" && !master} />
              )}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">In-app notifications are always on.</p>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Save notification settings
        </Button>
      </div>
    </form>
  );
}
