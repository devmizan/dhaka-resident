import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Building2, Flag } from "lucide-react";
import type { ListingStatus } from "@/generated/prisma/enums";
import { ListingModerationActions } from "@/components/admin/admin-actions";
import { EmptyState, ListingStatusBadge, PageHeader, SampleBadge } from "@/components/common/misc";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { LISTING_STATUS_LABELS } from "@/lib/labels";
import { formatRelative, formatRent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAdminListings } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Listings" };

const STATUSES = Object.keys(LISTING_STATUS_LABELS) as ListingStatus[];

export default async function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  await requirePageUser(["ADMIN"], "/admin/listings");
  const params = await searchParams;
  const status = STATUSES.includes(params.status as ListingStatus) ? (params.status as ListingStatus) : undefined;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminListings({ status, q, page });
  const href = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { status, q, page: undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/admin/listings?${s}` : "/admin/listings";
  };

  return (
    <>
      <PageHeader title="Listings" description={`${total} listing${total === 1 ? "" : "s"}${status ? ` · ${LISTING_STATUS_LABELS[status]}` : ""}`} />

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={href({ status: s })}
              aria-current={s === status ? "page" : undefined}
              className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold", s === status ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
            >
              {s ? LISTING_STATUS_LABELS[s] : "All"}
            </Link>
          ))}
        </nav>
        <form action="/admin/listings" className="flex gap-2" role="search">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="admin-listing-search" className="sr-only">
            Search listings
          </label>
          <input id="admin-listing-search" name="q" defaultValue={q} placeholder="Title or owner email" className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm lg:w-64" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {items.length ? (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map((listing) => {
            const rent = formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.category.usesRoomTypes);
            return (
              <li key={listing.id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
                    {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="144px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ListingStatusBadge status={listing.status} />
                      {listing.isDemo ? <SampleBadge /> : null}
                      {listing.isFeatured ? <span className="rounded-full bg-navy-900 px-2.5 py-0.5 text-xs font-semibold text-white">Featured</span> : null}
                      {listing._count.reports ? (
                        <Link href="/admin/reports" className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                          <Flag className="size-3" aria-hidden="true" />
                          {listing._count.reports} open report{listing._count.reports === 1 ? "" : "s"}
                        </Link>
                      ) : null}
                    </div>
                    <Link href={`/properties/${listing.slug}`} className="mt-1.5 block font-semibold text-navy-900 hover:underline">
                      {listing.title || "Untitled draft"}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {listing.category.name} · {[listing.neighborhood?.name, listing.city?.name].filter(Boolean).join(", ") || "No location"} · {listing.rentAmount ? `${rent.amount} ${rent.suffix}` : "No rent"} · {listing._count.photos} photos
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Owner: {listing.owner.name} ({listing.owner.email ?? listing.owner.phone}) · {listing.status === "PENDING_REVIEW" && listing.submittedAt ? `submitted ${formatRelative(listing.submittedAt)}` : `updated ${formatRelative(listing.updatedAt)}`}
                    </p>
                    {listing.rejectionReason && (listing.status === "REJECTED" || listing.status === "UNPUBLISHED") ? <p className="mt-1 text-sm text-red-800">Reason: {listing.rejectionReason}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/properties/${listing.slug}`}>Open listing</Link>
                      </Button>
                      <ListingModerationActions propertyId={listing.id} status={listing.status} isFeatured={listing.isFeatured} />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={Building2} title="No listings found" description={status === "PENDING_REVIEW" ? "The approval queue is empty." : "Try a different filter or search."} />
      )}
      <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => href({ page: p })} />
    </>
  );
}
