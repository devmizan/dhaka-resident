"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A per-submission key that lets the server ignore accidental duplicate submissions. */
export function useIdempotencyKey() {
  const [key, setKey] = useState(randomUuid);
  const rotate = useCallback(() => setKey(randomUuid()), []);
  return [key, rotate] as const;
}

/** Copies server-side field errors onto a react-hook-form instance. Returns the form-level message. */
export function applyActionErrors<T extends FieldValues>(form: Pick<UseFormReturn<T>, "setError">, result: ActionResult<unknown>): string | null {
  if (result.ok) return null;
  let focused = false;
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    if (messages?.[0]) {
      form.setError(field as Path<T>, { type: "server", message: messages[0] }, { shouldFocus: !focused });
      focused = true;
    }
  }
  return result.error;
}

export function FormAlert({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn("flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

type ControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

/** Label + control + help text + error, wired up with ids for screen readers. */
export function FormField({
  label,
  error,
  description,
  required,
  className,
  children,
}: {
  label: ReactNode;
  error?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-navy-900">
        {label}
        {required ? <span className="text-red-700" aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {description ? (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
