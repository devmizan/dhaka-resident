import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Camera, CalendarCheck, MapPin, Ruler, Users } from "lucide-react";
import { SampleBadge } from "@/components/common/misc";
import { SaveButton, type ViewerKind } from "@/components/listings/save-button";
import { FURNISHING_LABELS } from "@/lib/labels";
import { formatAvailability, formatNumber, formatRent } from "@/lib/format";
import type { ListingCardData } from "@/server/queries/listings";
import { cn } from "@/lib/utils";

export function ListingCard({
  listing,
  saved,
  viewer,
  priority = false,
  className,
}: {
  listing: ListingCardData;
  saved: boolean;
  viewer: ViewerKind;
  priority?: boolean;
  className?: string;
}) {
  const rent = formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.perBed);
  const features: { icon: typeof BedDouble; label: string }[] = [];
  if (listing.perBed && listing.availableBeds !== null) {
    features.push({ icon: Users, label: listing.availableBeds === 0 ? "No beds free" : `${listing.availableBeds} bed${listing.availableBeds === 1 ? "" : "s"} free` });
  } else if (listing.bedrooms) {
    features.push({ icon: BedDouble, label: `${listing.bedrooms} bed${listing.bedrooms === 1 ? "" : "s"}` });
  }
  if (listing.bathrooms && !listing.perBed) features.push({ icon: Bath, label: `${listing.bathrooms} bath${listing.bathrooms === 1 ? "" : "s"}` });
  if (listing.floorAreaSqft) features.push({ icon: Ruler, label: `${formatNumber(listing.floorAreaSqft)} sq ft` });

  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition-shadow hover:shadow-md", className)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.photo ? (
          <Image
            src={listing.photo.url}
            alt={listing.photo.altText ?? listing.title}
            fill
            loading={priority ? "eager" : "lazy"}
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">No photo yet</div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {listing.isDemo ? <SampleBadge /> : null}
          {listing.isFeatured ? (
            <span className="rounded-full bg-navy-900/90 px-2.5 py-0.5 text-xs font-semibold text-white">Featured</span>
          ) : null}
        </div>
        <div className="absolute top-2.5 right-2.5">
          <SaveButton propertyId={listing.id} initialSaved={saved} viewer={viewer} />
        </div>
        {listing.photoCount > 1 ? (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            <Camera className="size-3.5" aria-hidden="true" />
            {listing.photoCount}
            <span className="sr-only">photos</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
          {listing.categoryName}
          {listing.furnishing ? <span className="text-muted-foreground normal-case"> · {FURNISHING_LABELS[listing.furnishing]}</span> : null}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base leading-snug font-semibold text-navy-900">
          <Link href={`/properties/${listing.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{listing.locationLabel}</span>
        </p>

        <p className="mt-3 text-lg font-bold text-navy-900">
          {listing.perBed ? <span className="text-sm font-medium text-muted-foreground">From </span> : null}
          {rent.amount}
          <span className="text-sm font-medium text-muted-foreground"> {rent.suffix}</span>
        </p>

        {features.length ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-700">
            {features.map((feature) => (
              <li key={feature.label} className="inline-flex items-center gap-1.5">
                <feature.icon className="size-4 text-navy-400" aria-hidden="true" />
                {feature.label}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto flex items-center gap-1.5 pt-3 text-sm font-medium text-emerald-800">
          <CalendarCheck className="size-4" aria-hidden="true" />
          {formatAvailability(listing.availableFrom)}
        </p>
      </div>
    </article>
  );
}

export function ListingGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}

export function viewerKind(user: { role: string } | null): ViewerKind {
  if (!user) return "guest";
  return user.role === "TENANT" ? "tenant" : "other";
}
