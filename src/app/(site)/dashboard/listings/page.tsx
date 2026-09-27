import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Building2, CalendarClock, MessageSquare, Plus } from "lucide-react";
import type { ListingStatus } from "@/generated/prisma/enums";
import { EmptyState, ListingStatusBadge, Notice, PageHeader, SampleBadge } from "@/components/common/misc";
import { ListingStatusControls } from "@/components/owner/listing-status-controls";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { LISTING_STATUS_LABELS } from "@/lib/labels";
import { formatRelative, formatRent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getOwnerListings, getOwnerListingStatusCounts } from "@/server/queries/owner";

export const metadata: Metadata = { title: "My listings" };

const FILTERS: (ListingStatus | undefined)[] = [undefined, "PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED", "PAUSED", "RENTED", "UNPUBLISHED"];

export default async function OwnerListingsPage({ searchParams }: PageProps<"/dashboard/listings">) {
  const user = await requirePageUser(["OWNER"], "/dashboard/listings");
  const params = await searchParams;
  const status = FILTERS.includes(params.status as ListingStatus) ? (params.status as ListingStatus) : undefined;
  const [listings, counts] = await Promise.all([getOwnerListings(user.id, status), getOwnerListingStatusCounts(user.id)]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader
        title="My listings"
        description="Create, edit and manage your rental listings."
        actions={
          <Button asChild variant="emerald">
            <Link href="/dashboard/listings/new">
              <Plus data-icon="inline-start" />
              New listing
            </Link>
          </Button>
        }
      />
      {params.deleted === "1" ? <Notice className="mt-5">The listing was deleted.</Notice> : null}

      <nav aria-label="Filter by status" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.filter((f) => !f || counts[f]).map((f) => {
          const active = f === status;
          return (
            <Link
              key={f ?? "all"}
              href={f ? `/dashboard/listings?status=${f}` : "/dashboard/listings"}
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold", active ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
            >
              {f ? LISTING_STATUS_LABELS[f] : "All"}
              <span className={active ? "text-navy-200" : "text-muted-foreground"}>{f ? counts[f] : total}</span>
            </Link>
          );
        })}
      </nav>

      {listings.length ? (
        <ul className="mt-5 flex flex-col gap-3">
          {listings.map((listing) => {
            const rent = formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.category.usesRoomTypes);
            return (
              <li key={listing.id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href={`/dashboard/listings/${listing.id}`} className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
                    {listing.photos[0] ? (
                      <Image src={listing.photos[0].url} alt="" fill sizes="160px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-xs text-muted-foreground">No photos</span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ListingStatusBadge status={listing.status} />
                      {listing.isDemo ? <SampleBadge /> : null}
                      <span className="text-xs text-muted-foreground">Updated {formatRelative(listing.updatedAt)}</span>
                    </div>
                    <Link href={`/dashboard/listings/${listing.id}`} className="mt-1.5 block text-lg font-semibold text-navy-900 hover:underline">
                      {listing.title || "Untitled draft"}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {listing.category.name}
                      {listing.city ? ` · ${[listing.neighborhood?.name, listing.city.name].filter(Boolean).join(", ")}` : ""}
                      {listing.rentAmount ? ` · ${rent.amount} ${rent.suffix}` : ""}
                    </p>
                    {listing.status === "REJECTED" || listing.status === "UNPUBLISHED" ? (
                      <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-900">
                        <span className="font-semibold">Admin note:</span> {listing.rejectionReason}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-navy-700">
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquare className="size-4 text-navy-400" aria-hidden="true" />
                        {listing._count.enquiries} enquir{listing._count.enquiries === 1 ? "y" : "ies"}
                      </span>
                      {listing.viewingRequests.length ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                          <CalendarClock className="size-4" aria-hidden="true" />
                          {listing.viewingRequests.length} viewing request{listing.viewingRequests.length === 1 ? "" : "s"} to answer
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/listings/${listing.id}`}>Manage</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/listings/${listing.id}/edit/${listing.status === "DRAFT" && !listing.title ? "location" : "details"}`}>Edit</Link>
                      </Button>
                      {listing.status !== "DRAFT" ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/properties/${listing.slug}`}>{listing.status === "PUBLISHED" ? "View live" : "Preview"}</Link>
                        </Button>
                      ) : null}
                      <ListingStatusControls propertyId={listing.id} status={listing.status} canDelete={false} compact />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="mt-6"
          icon={Building2}
          title={status ? `No ${LISTING_STATUS_LABELS[status].toLowerCase()} listings` : "You haven't created any listings yet"}
          description="List an apartment, house, room, hostel, sublet or commercial space. Every listing is reviewed before it goes live."
          action={
            <Button asChild variant="emerald">
              <Link href="/dashboard/listings/new">Create a listing</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
