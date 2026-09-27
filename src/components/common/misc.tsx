import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, TriangleAlert } from "lucide-react";
import type { ListingStatus, ViewingStatus } from "@/generated/prisma/enums";
import { LISTING_STATUS_LABELS, VIEWING_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed bg-muted/40 px-6 py-12 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-full bg-white shadow-sm">
        <Icon className="size-6 text-navy-600" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
  PAUSED: "bg-slate-100 text-slate-700 ring-slate-300",
  RENTED: "bg-navy-50 text-navy-800 ring-navy-200",
  UNPUBLISHED: "bg-red-50 text-red-800 ring-red-200",
};

export function ListingStatusBadge({ status, className }: { status: ListingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", LISTING_STATUS_STYLES[status], className)}>
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}

const VIEWING_STATUS_STYLES: Record<ViewingStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DECLINED: "bg-red-50 text-red-800 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function ViewingStatusBadge({ status }: { status: ViewingStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", VIEWING_STATUS_STYLES[status])}>
      {VIEWING_STATUS_LABELS[status]}
    </span>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 ring-inset", className)}
      title="Sample content for demonstration — not a real property"
    >
      Sample listing
    </span>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning"; title?: string; children: ReactNode; className?: string }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-navy-100 bg-navy-50 text-navy-900",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5" : undefined}>{children}</div>
      </div>
    </div>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-emerald-700 underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  );
}

export function StatCard({ label, value, href, icon: Icon, hint }: { label: string; value: number | string; href?: string; icon: LucideIcon; hint?: string }) {
  const content = (
    <div className="flex items-start justify-between gap-3 rounded-2xl border bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold text-navy-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon className="size-5" aria-hidden="true" />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl">
      {content}
    </Link>
  ) : (
    content
  );
}
