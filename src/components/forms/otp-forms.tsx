"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyActionErrors, FormAlert, FormField } from "@/components/forms/form-helpers";
import { RoleChooser } from "@/components/forms/role-chooser";
import type { ActionResult } from "@/lib/action-result";
import { formatPhone } from "@/lib/phone";
import { otpLoginStartSchema, otpSignupStartSchema, otpVerifySchema, phoneVerificationStartSchema, setPasswordSchema } from "@/lib/validation/auth";
import {
  setPasswordAction,
  startOtpLoginAction,
  startOtpSignupAction,
  startPhoneVerificationAction,
  verifyOtpAction,
  verifyPhoneAction,
} from "@/server/actions/auth";

export type OtpAvailability = { email: boolean; sms: boolean; emailViaConsole: boolean; smsViaConsole: boolean };
type Challenge = { challengeId: string; channel: "EMAIL" | "SMS"; sentTo: string; printedToConsole: boolean };

const RESEND_SECONDS = 60;

function contactCopy(availability: OtpAvailability) {
  if (availability.email && availability.sms) return { label: "Email or mobile number", placeholder: "you@example.com or 01712-345678", inputMode: "email" as const };
  if (availability.sms) return { label: "Mobile number", placeholder: "01712-345678", inputMode: "tel" as const };
  return { label: "Email", placeholder: "you@example.com", inputMode: "email" as const };
}

export function OtpUnavailable() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">One-time codes aren&apos;t available right now</p>
      <p className="mt-1">Email and SMS delivery aren&apos;t configured on this server. Please use a password instead.</p>
    </div>
  );
}

/** Step 2 for every code flow: enter the 6-digit code, resend after a cooldown, or go back. */
function CodeStep({
  challenge,
  onVerify,
  onResend,
  onBack,
  submitLabel,
}: {
  challenge: Challenge;
  onVerify: (values: { challengeId: string; code: string }) => Promise<ActionResult<unknown> | undefined>;
  onResend: () => Promise<Challenge | null>;
  onBack: () => void;
  submitLabel: string;
}) {
  const [current, setCurrent] = useState(challenge);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(otpVerifySchema), defaultValues: { challengeId: challenge.challengeId, code: "" } });
  const { register, handleSubmit, formState, setValue, setFocus } = form;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFocus("code");
  }, [setFocus, current.challengeId]);

  const secondsLeft = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const result = await onVerify({ challengeId: current.challengeId, code: form.getValues("code") });
    if (result && !result.ok) setFormError(applyActionErrors(form, result));
  });

  async function resend() {
    setResending(true);
    setFormError(null);
    const next = await onResend();
    setResending(false);
    if (!next) return;
    setCurrent(next);
    setValue("challengeId", next.challengeId);
    setValue("code", "");
    setSentAt(Date.now());
    toast.success("A new code is on its way");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex gap-3 rounded-xl bg-navy-50 p-4 text-sm text-navy-900">
        <MessageSquareText className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <p>
          We sent a 6-digit code {current.channel === "SMS" ? "by SMS" : "by email"} to <strong>{current.sentTo}</strong>. It expires in 10 minutes.
        </p>
      </div>
      {current.printedToConsole ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {current.channel === "SMS" ? "SMS" : "Email"} delivery isn&apos;t configured on this development server, so nothing was sent. The code is printed in the terminal running <code className="rounded bg-amber-100 px-1">npm run dev</code>.
        </p>
      ) : null}
      <FormAlert message={formError} />
      <FormField label="6-digit code" error={formState.errors.code?.message}>
        {(p) => (
          <Input
            {...p}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="••••••"
            className="h-14 text-center text-2xl font-semibold tracking-[0.5em]"
            {...register("code")}
          />
        )}
      </FormField>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
        {submitLabel}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-1.5 font-medium text-navy-700 hover:text-navy-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Change details
        </button>
        <button type="button" onClick={resend} disabled={secondsLeft > 0 || resending} className="h-10 font-semibold text-emerald-700 hover:underline disabled:text-muted-foreground disabled:no-underline" aria-live="polite">
          {resending ? "Sending…" : secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

function reportStart<T>(result: ActionResult<T>): T | null {
  if (!result.ok) {
    toast.error(result.error);
    return null;
  }
  return result.data;
}

export function OtpSignupForm({ defaultRole, next, availability }: { defaultRole: "TENANT" | "OWNER"; next?: string; availability: OtpAvailability }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(otpSignupStartSchema),
    defaultValues: { name: "", contact: "", role: defaultRole, acceptTerms: false as unknown as true },
  });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const role = watch("role");
  const copy = contactCopy(availability);

  if (!availability.email && !availability.sms) return <OtpUnavailable />;

  // Send the raw inputs: the server parses and normalises them itself.
  const start = () => startOtpSignupAction(form.getValues());

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const result = await start();
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    setChallenge(result.data);
  });

  if (challenge) {
    return (
      <CodeStep
        challenge={challenge}
        submitLabel="Verify and create account"
        onVerify={async (values) => {
          const result = await verifyOtpAction({ ...values, next });
          // Full page load so the header renders the new session.
          if (result.ok) window.location.assign(result.data.redirectTo);
          return result;
        }}
        onResend={async () => reportStart(await start())}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <RoleChooser name="otp-role" value={role} onChange={(r) => setValue("role", r)} error={formState.errors.role?.message} />
      <FormField label="Full name" required error={formState.errors.name?.message}>
        {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
      </FormField>
      <FormField
        label={copy.label}
        required
        error={formState.errors.contact?.message}
        description="We'll send a 6-digit code to confirm it's you. No password needed — you can add one later."
      >
        {(p) => <Input {...p} autoComplete="username" inputMode={copy.inputMode} placeholder={copy.placeholder} {...register("contact")} />}
      </FormField>
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
        Send code
      </Button>
    </form>
  );
}

export function OtpLoginForm({ next, availability }: { next?: string; availability: OtpAvailability }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(otpLoginStartSchema), defaultValues: { contact: "" } });
  const { register, handleSubmit, formState } = form;
  const copy = contactCopy(availability);

  if (!availability.email && !availability.sms) return <OtpUnavailable />;

  const start = () => startOtpLoginAction(form.getValues());

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const result = await start();
    if (!result.ok) return setFormError(applyActionErrors(form, result));
    setChallenge(result.data);
  });

  if (challenge) {
    return (
      <CodeStep
        challenge={challenge}
        submitLabel="Verify and log in"
        onVerify={async (values) => {
          const result = await verifyOtpAction({ ...values, next });
          // Full page load so the header renders the new session.
          if (result.ok) window.location.assign(result.data.redirectTo);
          return result;
        }}
        onResend={async () => reportStart(await start())}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={formError} />
      <FormField
        label={copy.label}
        error={formState.errors.contact?.message}
        description={availability.sms ? "Mobile login works once your number has been verified." : undefined}
      >
        {(p) => <Input {...p} autoComplete="username" inputMode={copy.inputMode} placeholder={copy.placeholder} {...register("contact")} />}
      </FormField>
      <Button type="submit" size="lg" variant="emerald" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        Send code
      </Button>
      <p className="text-xs text-muted-foreground">If an account matches, we&apos;ll send it a code. For your security we don&apos;t say whether an account exists.</p>
    </form>
  );
}

export function PhoneVerificationForm({ phone, verified, smsAvailable }: { phone: string | null; verified: boolean; smsAvailable: boolean }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(phoneVerificationStartSchema), defaultValues: { phone: phone ? formatPhone(phone) : "" } });
  const { register, handleSubmit, formState } = form;

  if (!smsAvailable) {
    return <p className="text-sm text-muted-foreground">SMS delivery isn&apos;t configured on this server, so mobile numbers can&apos;t be verified yet.</p>;
  }

  const start = () => startPhoneVerificationAction(form.getValues());

  if (challenge) {
    return (
      <CodeStep
        challenge={challenge}
        submitLabel="Verify number"
        onVerify={async (values) => {
          const result = await verifyPhoneAction(values);
          if (result.ok) {
            toast.success(result.message);
            setChallenge(null);
            router.refresh();
          }
          return result;
        }}
        onResend={async () => reportStart(await start())}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async () => {
        setFormError(null);
        const result = await start();
        if (!result.ok) return setFormError(applyActionErrors(form, result));
        setChallenge(result.data);
      })}
      className="flex flex-col gap-3"
      noValidate
    >
      <FormAlert message={formError} />
      <FormField
        label="Mobile number"
        error={formState.errors.phone?.message}
        description={verified ? "Verified — you can log in with a code sent by SMS. Enter a different number to change it." : "Verify your number to log in with a code sent by SMS."}
      >
        {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="01712-345678" className="sm:max-w-xs" {...register("phone")} />}
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {verified ? "Verify a new number" : "Send verification code"}
        </Button>
      </div>
    </form>
  );
}

export function SetPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(setPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });
  const { register, handleSubmit, formState, reset } = form;
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        const result = await setPasswordAction(values);
        if (!result.ok) return setFormError(applyActionErrors(form, result));
        toast.success(result.message);
        reset();
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="New password" error={formState.errors.newPassword?.message} description="At least 10 characters with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("newPassword")} />}
        </FormField>
        <FormField label="Confirm password" error={formState.errors.confirmPassword?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("confirmPassword")} />}
        </FormField>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Set password
        </Button>
      </div>
    </form>
  );
}
