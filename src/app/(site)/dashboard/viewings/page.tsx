import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { EmptyState, Notice, PageHeader, ViewingStatusBadge } from "@/components/common/misc";
import { ViewingActions } from "@/components/dashboard/viewing-actions";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getViewingsForUser } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Viewings" };

export default async function ViewingsPage({ searchParams }: PageProps<"/dashboard/viewings">) {
  const user = await requirePageUser(["TENANT", "OWNER"], "/dashboard/viewings");
  const params = await searchParams;
  const scope = params.scope === "past" ? "past" : "upcoming";
  const isOwner = user.role === "OWNER";
  const viewings = await getViewingsForUser(user, scope);

  return (
    <>
      <PageHeader
        title={isOwner ? "Viewing requests" : "My viewing requests"}
        description={isOwner ? "Accept or decline requests from tenants. Offer viewing times from each listing's management page." : "Track the viewings you've requested."}
        actions={
          isOwner ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/listings">Offer viewing times</Link>
            </Button>
          ) : null
        }
      />
      <Notice className="mt-5">A viewing appointment is not a booking or rental agreement. Never pay a deposit before seeing a property and signing an agreement.</Notice>

      <nav aria-label="Viewing time range" className="mt-5 flex gap-2">
        {(["upcoming", "past"] as const).map((s) => (
          <Link
            key={s}
            href={s === "upcoming" ? "/dashboard/viewings" : "/dashboard/viewings?scope=past"}
            aria-current={scope === s ? "page" : undefined}
            className={cn("inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold capitalize", scope === s ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
          >
            {s}
          </Link>
        ))}
      </nav>

      {viewings.length ? (
        <ul className="mt-5 flex flex-col gap-3">
          {viewings.map((v) => {
            const tz = v.property.city?.country.timeZone;
            const upcoming = scope === "upcoming";
            const actions: ("accept" | "decline" | "cancel")[] = !upcoming
              ? []
              : isOwner
                ? v.status === "PENDING"
                  ? ["accept", "decline"]
                  : v.status === "ACCEPTED"
                    ? ["cancel"]
                    : []
                : v.status === "PENDING" || v.status === "ACCEPTED"
                  ? ["cancel"]
                  : [];
            return (
              <li key={v.id} className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ViewingStatusBadge status={v.status} />
                      <span className="text-sm text-muted-foreground">{v.slotId ? "Offered time" : "Time suggested by tenant"}</span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-navy-900">
                      {formatDateTime(v.startsAt, tz, { weekday: "short" })} – {formatTime(v.endsAt, tz)}
                    </p>
                    <Link href={`/properties/${v.property.slug}`} className="mt-1 block font-semibold text-navy-800 hover:underline">
                      {v.property.title}
                    </Link>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {[v.property.approximateArea, v.property.neighborhood?.name, v.property.city?.name].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-2 text-sm text-navy-800">{isOwner ? `Tenant: ${v.tenant.name}` : `Owner: ${v.owner.companyName ?? v.owner.name}`}</p>
                    {v.tenantNote ? (
                      <p className="mt-1 text-sm text-navy-700">
                        <span className="font-medium">Tenant note:</span> {v.tenantNote}
                      </p>
                    ) : null}
                    {v.ownerNote ? (
                      <p className="mt-1 text-sm text-navy-700">
                        <span className="font-medium">Owner note:</span> {v.ownerNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <ViewingActions viewingId={v.id} actions={actions} />
                    {v.enquiryId ? (
                      <Link href={`/dashboard/messages/${v.enquiryId}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                        Open conversation
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="mt-6"
          icon={CalendarClock}
          title={scope === "upcoming" ? "No upcoming viewings" : "No past viewings"}
          description={isOwner ? "Viewing requests from tenants will appear here." : "Request a viewing from any listing page."}
        />
      )}
    </>
  );
}
