"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import { RoleChooser } from "@/components/forms/role-chooser";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/actions/auth";

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-0 right-0 grid h-10 w-11 place-items-center text-muted-foreground hover:text-navy-900"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", next } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await loginAction(values);
    // A full page load (rather than a client-side navigation) so the header renders the new session.
    if (result.ok) return void window.location.assign(result.data.redirectTo);
    setFormError(applyActionErrors(form, result));
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField label="Email" error={formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </FormField>
      <FormField label="Password" error={formState.errors.password?.message}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" {...register("password")} />}
      </FormField>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-emerald-700 hover:underline">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        Log in
      </Button>
    </form>
  );
}

export function RegisterForm({ defaultRole, next }: { defaultRole: "TENANT" | "OWNER"; next?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", role: defaultRole, password: "", confirmPassword: "", acceptTerms: false as unknown as true },
  });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const role = watch("role");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await registerAction({ ...values, next });
    if (result.ok) return void window.location.assign(result.data.redirectTo);
    setFormError(applyActionErrors(form, result));
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <RoleChooser name="password-role" value={role} onChange={(r) => setValue("role", r)} error={formState.errors.role?.message} />
      <FormField label="Full name" required error={formState.errors.name?.message}>
        {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Email" required error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
        </FormField>
        <FormField label="Mobile number" error={formState.errors.phone?.message} description="Optional. Never shown publicly.">
          {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="01712-345678" {...register("phone")} />}
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Password" required error={formState.errors.password?.message} description="At least 10 characters with a letter and a number.">
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("password")} />}
        </FormField>
        <FormField label="Confirm password" required error={formState.errors.confirmPassword?.message}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("confirmPassword")} />}
        </FormField>
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm text-navy-800">
          <input type="checkbox" className="mt-0.5 size-5 accent-emerald-700" {...register("acceptTerms")} aria-invalid={Boolean(formState.errors.acceptTerms)} />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-emerald-700 underline" target="_blank">
              terms of use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-emerald-700 underline" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {formState.errors.acceptTerms ? <p className="mt-1 text-sm text-red-700">{formState.errors.acceptTerms.message}</p> : null}
      </div>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ emailConfigured: boolean } | null>(null);
  const form = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await forgotPasswordAction(values);
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      return;
    }
    setSent(result.data);
  });

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>If an account exists for that email, a password reset link has been created. It expires in 1 hour.</p>
        </div>
        {!sent.emailConfigured ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Email delivery is not configured on this server</p>
            <p className="mt-1">
              No email was sent. In local development the reset link is printed in the terminal running <code className="rounded bg-amber-100 px-1">npm run dev</code>. An administrator can also create a reset link from the admin dashboard.
            </p>
          </div>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/login">Back to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField label="Email" error={formState.errors.email?.message}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </FormField>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: "", confirmPassword: "" } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await resetPasswordAction(values);
    if (result && !result.ok) setFormError(applyActionErrors(form, result));
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField label="New password" error={formState.errors.password?.message} description="At least 10 characters with a letter and a number.">
        {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("password")} />}
      </FormField>
      <FormField label="Confirm new password" error={formState.errors.confirmPassword?.message}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        Set new password
      </Button>
    </form>
  );
}
