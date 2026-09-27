import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Heart, MessageSquare, Pencil } from "lucide-react";
import { ListingStatusBadge, Notice, SampleBadge, StatCard } from "@/components/common/misc";
import { ListingStatusControls } from "@/components/owner/listing-status-controls";
import { AvailabilityForm, CancelSlotButton, ViewingSlotForm } from "@/components/owner/manage-forms";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { toCalendarDateString, todayCalendarDate } from "@/lib/dates";
import { formatDate, formatDateTime, formatRent, formatTime } from "@/lib/format";
import { LISTING_STEPS } from "@/lib/validation/listing";
import { getListingManagementData } from "@/server/queries/owner";

export const metadata: Metadata = { title: "Manage listing" };

const STATUS_HELP: Record<string, string> = {
  DRAFT: "This listing is a draft. Complete all steps and submit it for approval.",
  PENDING_REVIEW: "Our team is reviewing this listing. You'll be notified when it's approved or if changes are needed.",
  PUBLISHED: "This listing is live and visible to tenants.",
  REJECTED: "Changes were requested. Edit the listing and submit it again.",
  PAUSED: "This listing is paused and hidden from tenants. Resume it any time.",
  RENTED: "Marked as rented and hidden from tenants. Relist it when it becomes available again.",
  UNPUBLISHED: "An administrator unpublished this listing. Make the requested changes and submit it again.",
};

export default async function ManageListingPage({ params, searchParams }: PageProps<"/dashboard/listings/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePageUser(["OWNER"], `/dashboard/listings/${id}`);
  const listing = await getListingManagementData(user.id, id);
  if (!listing) notFound();

  const timeZone = listing.city?.country.timeZone ?? "Asia/Dhaka";
  const rent = formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.category.usesRoomTypes);
  const canOfferSlots = !["RENTED", "UNPUBLISHED"].includes(listing.status);

  return (
    <>
      <Link href="/dashboard/listings" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        My listings
      </Link>

      {query.submitted === "1" ? (
        <Notice className="mt-2 mb-4" title="Submitted for approval">
          Thanks! Our team will review your listing. You&apos;ll get a notification when it&apos;s live.
        </Notice>
      ) : null}

      <div className="mt-2 flex flex-col gap-5 rounded-2xl border bg-white p-5 sm:flex-row">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-56">
          {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="224px" className="object-cover" /> : <span className="grid h-full place-items-center text-sm text-muted-foreground">No photos yet</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={listing.status} />
            {listing.isDemo ? <SampleBadge /> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{listing.title || "Untitled draft"}</h1>
          <p className="text-sm text-muted-foreground">
            {listing.category.name}
            {listing.city ? ` · ${[listing.neighborhood?.name, listing.city.name].filter(Boolean).join(", ")}` : ""}
            {listing.rentAmount ? ` · ${rent.amount} ${rent.suffix}` : ""}
          </p>
          <p className="mt-3 text-sm text-navy-800">{STATUS_HELP[listing.status]}</p>
          {listing.rejectionReason && (listing.status === "REJECTED" || listing.status === "UNPUBLISHED") ? (
            <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              <span className="font-semibold">Admin note:</span> {listing.rejectionReason}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/listings/${id}/edit/${listing.status === "DRAFT" ? "location" : LISTING_STEPS[2].key}`}>
                <Pencil data-icon="inline-start" />
                Edit listing
              </Link>
            </Button>
            {listing.title ? (
              <Button asChild variant="ghost">
                <Link href={`/properties/${listing.slug}`}>
                  <ExternalLink data-icon="inline-start" />
                  {listing.status === "PUBLISHED" ? "View live" : "Preview"}
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="mt-3">
            <ListingStatusControls propertyId={id} status={listing.status} canDelete={(listing.status === "DRAFT" || listing.status === "REJECTED") && listing._count.enquiries === 0} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {listing.publishedAt ? `First published ${formatDate(listing.publishedAt)} · ` : ""}Last updated {formatDate(listing.updatedAt)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Enquiries" value={listing._count.enquiries} icon={MessageSquare} href="/dashboard/messages" />
        <StatCard label="Viewing requests to answer" value={listing.pendingViewings} icon={CalendarClock} href="/dashboard/viewings" />
        <StatCard label="Saved by tenants" value={listing._count.favorites} icon={Heart} />
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="availability-heading">
        <h2 id="availability-heading" className="text-lg font-bold">
          {listing.category.usesRoomTypes ? "Room and bed availability" : "Availability"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Keep this up to date so tenants only contact you about places that are free.</p>
        <AvailabilityForm propertyId={id} availableFrom={toCalendarDateString(listing.availableFrom) || toCalendarDateString(todayCalendarDate())} rooms={listing.roomTypes} />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="slots-heading">
        <h2 id="slots-heading" className="text-lg font-bold">
          Viewing times
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Offer times when tenants can view the property ({listing.city?.country.name ?? "local"} time). Tenants request a time and you accept or decline. Overlapping times across your listings are blocked.
        </p>
        {listing.viewingSlots.length ? (
          <ul className="mb-5 divide-y rounded-xl border">
            {listing.viewingSlots.map((slot) => {
              const accepted = slot.viewingRequests.find((r) => r.status === "ACCEPTED");
              const pending = slot.viewingRequests.filter((r) => r.status === "PENDING").length;
              return (
                <li key={slot.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-navy-900">
                      {formatDateTime(slot.startsAt, timeZone, { weekday: "short" })} – {formatTime(slot.endsAt, timeZone)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {accepted ? `Booked for a viewing with ${accepted.tenant.name}` : pending ? `${pending} pending request${pending === 1 ? "" : "s"}` : "Open"}
                      {slot.note ? ` · ${slot.note}` : ""}
                    </p>
                  </div>
                  <CancelSlotButton slotId={slot.id} hasRequests={slot.viewingRequests.length > 0} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mb-5 text-sm text-muted-foreground">No upcoming viewing times offered.</p>
        )}
        {canOfferSlots ? <ViewingSlotForm propertyId={id} minDate={toCalendarDateString(todayCalendarDate())} /> : <p className="text-sm text-muted-foreground">Viewing times can&apos;t be offered for rented or unpublished listings.</p>}
      </section>
    </>
  );
}
