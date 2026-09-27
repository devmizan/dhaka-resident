"use client";

import { Building2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type SelfServiceRole = "TENANT" | "OWNER";

const ROLES = [
  { value: "TENANT" as const, icon: UserRound, title: "I'm looking to rent", text: "Save properties, send enquiries and request viewings." },
  { value: "OWNER" as const, icon: Building2, title: "I own or manage property", text: "Publish listings and manage enquiries and viewings." },
];

export function RoleChooser({ value, onChange, error, name }: { value: SelfServiceRole; onChange: (role: SelfServiceRole) => void; error?: string; name: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-navy-900">Account type</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-emerald-600/30",
              value === option.value ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "hover:bg-navy-50",
            )}
          >
            <input type="radio" name={name} value={option.value} className="sr-only" checked={value === option.value} onChange={() => onChange(option.value)} />
            <option.icon className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-navy-900">{option.title}</span>
              <span className="block text-xs text-muted-foreground">{option.text}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </fieldset>
  );
}
