import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  Bath,
  BedDouble,
  Building,
  CalendarCheck,
  CalendarRange,
  Check,
  ChevronRight,
  Cigarette,
  Dog,
  Info,
  Lock,
  MapPin,
  Ruler,
  Sofa,
  Users,
} from "lucide-react";
import { ListingStatusBadge, Notice, SampleBadge } from "@/components/common/misc";
import { NamedIcon } from "@/components/icons";
import { ListingCard, viewerKind } from "@/components/listings/listing-card";
import { SaveButton } from "@/components/listings/save-button";
import { PhotoGallery } from "@/components/property/photo-gallery";
import { EnquiryDialog, ReportDialog, ViewingDialog } from "@/components/property/property-actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toCalendarDateString, todayCalendarDate } from "@/lib/dates";
import {
  AMENITY_GROUP_LABELS,
  BATHROOM_TYPE_LABELS,
  BILLING_PERIOD_SHORT,
  FURNISHING_LABELS,
  PET_POLICY_LABELS,
  TENANT_PREFERENCE_LABELS,
  VIEWING_STATUS_LABELS,
} from "@/lib/labels";
import { formatAvailability, formatDate, formatDateTime, formatMoney, formatNumber, formatRent } from "@/lib/format";
import { getFavoriteIds, getOpenViewingSlots, getPropertyForView, getRelatedListings } from "@/server/queries/listings";

const loadProperty = cache(async (slug: string) => {
  const user = await getCurrentUser();
  return { user, property: await getPropertyForView(slug, user) };
});

export async function generateMetadata({ params }: PageProps<"/properties/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { property } = await loadProperty(slug);
  if (!property) return { title: "Listing not found" };
  const location = [property.neighborhood?.name, property.city?.name].filter(Boolean).join(", ");
  const rent = formatRent(property.rentAmount, property.billingPeriod, property.currencyCode, property.category.usesRoomTypes);
  const description = `${property.category.name} in ${location} — ${rent.amount} ${rent.suffix}. ${property.description.slice(0, 140)}`;
  return {
    title: `${property.title}${location ? ` · ${location}` : ""}`,
    description,
    alternates: { canonical: `/properties/${property.slug}` },
    robots: property.status === "PUBLISHED" ? undefined : { index: false, follow: false },
    openGraph: {
      title: property.title,
      description,
      type: "website",
      images: property.photos[0] ? [{ url: property.photos[0].url, alt: property.photos[0].altText ?? property.title }] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: PageProps<"/properties/[slug]">) {
  const { slug } = await params;
  const { user, property } = await loadProperty(slug);
  if (!property) notFound();

  const isTenant = user?.role === "TENANT";
  const timeZone = property.city?.country.timeZone ?? "Asia/Dhaka";
  const [related, slots, favorites, enquiry, activeViewing, openReport] = await Promise.all([
    getRelatedListings(property),
    property.status === "PUBLISHED" ? getOpenViewingSlots(property.id) : Promise.resolve([]),
    getFavoriteIds(isTenant ? user!.id : undefined, [property.id]),
    isTenant ? db.enquiry.findUnique({ where: { propertyId_tenantId: { propertyId: property.id, tenantId: user!.id } }, select: { id: true } }) : null,
    isTenant
      ? db.viewingRequest.findFirst({
          where: { propertyId: property.id, tenantId: user!.id, status: { in: ["PENDING", "ACCEPTED"] }, endsAt: { gt: new Date() } },
          select: { status: true, startsAt: true },
        })
      : null,
    user ? db.report.count({ where: { propertyId: property.id, reporterId: user.id, status: "OPEN" } }) : 0,
  ]);
  const relatedFavorites = await getFavoriteIds(isTenant ? user!.id : undefined, related.map((r) => r.id));

  const usesRooms = property.category.usesRoomTypes;
  const rent = formatRent(property.rentAmount, property.billingPeriod, property.currencyCode, usesRooms);
  const location = [property.neighborhood?.name, property.city?.name].filter(Boolean).join(", ");
  const period = BILLING_PERIOD_SHORT[property.billingPeriod];
  const totalBeds = property.roomTypes.reduce((sum, r) => sum + r.totalBeds, 0);
  const availableBeds = property.roomTypes.reduce((sum, r) => sum + r.availableBeds, 0);
  const minDate = toCalendarDateString(todayCalendarDate());
  const amenityGroups = (Object.keys(AMENITY_GROUP_LABELS) as (keyof typeof AMENITY_GROUP_LABELS)[])
    .map((group) => ({ group, items: property.amenities.map((a) => a.amenity).filter((a) => a.group === group) }))
    .filter((g) => g.items.length);

  const facts = [
    usesRooms
      ? { icon: Users, label: "Beds available", value: `${availableBeds} of ${totalBeds}` }
      : property.bedrooms !== null
        ? { icon: BedDouble, label: "Bedrooms", value: String(property.bedrooms) }
        : null,
    property.bathrooms !== null ? { icon: Bath, label: "Bathrooms", value: String(property.bathrooms) } : null,
    property.floorAreaSqft ? { icon: Ruler, label: "Floor area", value: `${formatNumber(property.floorAreaSqft)} sq ft` } : null,
    property.furnishing ? { icon: Sofa, label: "Furnishing", value: FURNISHING_LABELS[property.furnishing] } : null,
    property.bathroomType ? { icon: Bath, label: "Bathroom", value: BATHROOM_TYPE_LABELS[property.bathroomType].replace(" bathroom", "") } : null,
    property.floorNumber !== null ? { icon: Building, label: "Floor", value: property.floorNumber === 0 ? "Ground" : `${property.floorNumber}${property.totalFloors ? ` of ${property.totalFloors}` : ""}` } : null,
    { icon: CalendarCheck, label: "Available", value: formatAvailability(property.availableFrom).replace("Available ", "").replace(/^now$/, "Now") },
    property.minimumStay ? { icon: CalendarRange, label: "Minimum stay", value: `${property.minimumStay} ${period}${property.minimumStay === 1 ? "" : "s"}` } : null,
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  const fees = [
    { label: usesRooms ? `Rent per bed (from)` : "Rent", value: `${rent.amount} / ${period}${property.rentNegotiable ? " (negotiable)" : ""}` },
    property.securityDeposit !== null ? { label: "Security deposit", value: formatMoney(property.securityDeposit, property.currencyCode) } : null,
    property.advanceRentMonths ? { label: "Advance rent", value: `${property.advanceRentMonths} month${property.advanceRentMonths === 1 ? "" : "s"}` } : null,
    property.serviceCharge !== null ? { label: "Service charge", value: property.serviceCharge === 0 ? "None" : `${formatMoney(property.serviceCharge, property.currencyCode)} / month` } : null,
    { label: "Utilities", value: property.utilitiesIncluded ? "Included in rent" : "Not included" },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  const mapBbox = property.mapCenter
    ? [property.mapCenter.lng - 0.012, property.mapCenter.lat - 0.008, property.mapCenter.lng + 0.012, property.mapCenter.lat + 0.008].map((n) => n.toFixed(4)).join(",")
    : null;

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/search" className="hover:text-navy-900 hover:underline">
              Rentals
            </Link>
          </li>
          {property.city ? (
            <>
              <ChevronRight className="size-4" aria-hidden="true" />
              <li>
                <Link href={`/search?city=${property.city.slug}`} className="hover:text-navy-900 hover:underline">
                  {property.city.name}
                </Link>
              </li>
            </>
          ) : null}
          {property.neighborhood && property.city ? (
            <>
              <ChevronRight className="size-4" aria-hidden="true" />
              <li>
                <Link href={`/search?city=${property.city.slug}&area=${property.neighborhood.slug}`} className="hover:text-navy-900 hover:underline">
                  {property.neighborhood.name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      {property.status !== "PUBLISHED" ? (
        <Notice tone="warning" className="mb-4" title="Preview — not visible to tenants">
          This listing is currently <ListingStatusBadge status={property.status} className="mx-1 align-middle" /> and only you{property.viewerIsAdmin ? " (as an administrator)" : ""} can see this page.
          {property.viewerIsOwner ? (
            <>
              {" "}
              <Link href={`/dashboard/listings/${property.id}`} className="font-semibold underline">
                Manage listing
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}

      {property.isDemo ? (
        <Notice className="mb-4" title="Sample listing">
          This listing was created to demonstrate Dhaka Resident. It is not a real property and the owner account is a demo account.
        </Notice>
      ) : null}

      <PhotoGallery photos={property.photos} title={property.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">{property.category.name}</span>
            {property.isDemo ? <SampleBadge /> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{property.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-navy-700">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {property.approximateArea ? `${property.approximateArea}, ` : ""}
            {location}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-xl border bg-white p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <fact.icon className="size-4" aria-hidden="true" />
                  {fact.label}
                </dt>
                <dd className="mt-1 font-semibold text-navy-900">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <Section title="About this property">
            <p className="leading-relaxed whitespace-pre-line text-navy-800">{property.description}</p>
          </Section>

          {usesRooms && property.roomTypes.length ? (
            <Section title="Rooms and beds">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Room types, beds and prices</caption>
                  <thead className="bg-muted text-navy-700">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Room type</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Beds per room</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Available beds</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Bathroom</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Price per bed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {property.roomTypes.map((room) => (
                      <tr key={room.id}>
                        <th scope="row" className="px-4 py-3 font-semibold text-navy-900">
                          {room.name}
                          {room.description ? <span className="block text-xs font-normal text-muted-foreground">{room.description}</span> : null}
                        </th>
                        <td className="px-4 py-3">{room.bedsPerRoom}</td>
                        <td className="px-4 py-3">
                          <span className={room.availableBeds === 0 ? "text-red-700" : "font-semibold text-emerald-800"}>
                            {room.availableBeds === 0 ? "Full" : `${room.availableBeds} of ${room.totalBeds}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">{room.bathroomType === "PRIVATE" ? "Private" : "Shared"}</td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {formatMoney(room.pricePerBed, property.currencyCode)} <span className="font-normal text-muted-foreground">/ {BILLING_PERIOD_SHORT[room.billingPeriod]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {availableBeds} of {totalBeds} beds currently available.
              </p>
              {property.includedFacilities ? (
                <div className="mt-4 rounded-xl bg-navy-50 p-4">
                  <h3 className="text-sm font-semibold">Included facilities</h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-navy-800">{property.includedFacilities}</p>
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title="Rent, deposit and fees">
            <dl className="divide-y rounded-xl border">
              {fees.map((fee) => (
                <div key={fee.label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between">
                  <dt className="text-navy-700">{fee.label}</dt>
                  <dd className="font-semibold text-navy-900">{fee.value}</dd>
                </div>
              ))}
            </dl>
            {property.utilitiesNote ? <p className="mt-3 text-sm text-navy-700">{property.utilitiesNote}</p> : null}
            {property.otherFees ? (
              <p className="mt-2 text-sm text-navy-700">
                <span className="font-semibold">Other fees: </span>
                {property.otherFees}
              </p>
            ) : null}
          </Section>

          {amenityGroups.length ? (
            <Section title="Amenities and accessibility">
              <div className="grid gap-6 sm:grid-cols-2">
                {amenityGroups.map(({ group, items }) => (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-navy-700">{AMENITY_GROUP_LABELS[group]}</h3>
                    <ul className="mt-2 space-y-2">
                      {items.map((amenity) => (
                        <li key={amenity.id} className="flex items-center gap-2.5 text-navy-800">
                          <NamedIcon name={amenity.icon} className="size-5 text-emerald-700" />
                          {amenity.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="House rules and tenant preferences">
            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="flex items-center gap-2.5 text-navy-800">
                <Dog className="size-5 text-navy-400" aria-hidden="true" />
                {PET_POLICY_LABELS[property.petPolicy]}
              </li>
              <li className="flex items-center gap-2.5 text-navy-800">
                <Cigarette className="size-5 text-navy-400" aria-hidden="true" />
                {property.smokingAllowed ? "Smoking allowed" : "No smoking"}
              </li>
              <li className="flex items-center gap-2.5 text-navy-800">
                <Users className="size-5 text-navy-400" aria-hidden="true" />
                {TENANT_PREFERENCE_LABELS[property.tenantPreference]}
              </li>
              {property.minimumStay ? (
                <li className="flex items-center gap-2.5 text-navy-800">
                  <CalendarRange className="size-5 text-navy-400" aria-hidden="true" />
                  Minimum {property.minimumStay} {period}
                  {property.minimumStay === 1 ? "" : "s"}
                </li>
              ) : null}
            </ul>
            {property.houseRules ? (
              <ul className="mt-4 space-y-1.5">
                {property.houseRules
                  .split("\n")
                  .map((rule) => rule.trim())
                  .filter(Boolean)
                  .map((rule, i) => (
                    <li key={i} className="flex gap-2.5 text-navy-800">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      {rule}
                    </li>
                  ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Location">
            <p className="flex items-start gap-2 text-navy-800">
              <MapPin className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                {property.addressLine ? (
                  <>
                    <span className="font-semibold">{property.addressLine}</span>
                    <br />
                  </>
                ) : null}
                {property.approximateArea ? `${property.approximateArea}, ` : ""}
                {location}
              </span>
            </p>
            {!property.addressLine ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {property.addressVisibility === "AFTER_ACCEPTED_VIEWING"
                  ? "The owner shares the exact address once a viewing is accepted."
                  : "The owner shares the exact address privately in messages."}
              </p>
            ) : null}
            {mapBbox ? (
              <div className="mt-4 overflow-hidden rounded-xl border">
                <iframe
                  title={`Approximate area map for ${location}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik`}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin"
                />
                <p className="flex items-center gap-1.5 bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <Info className="size-3.5" aria-hidden="true" />
                  Map shows the general area only (about 1 km), not the exact building. © OpenStreetMap contributors.
                </p>
              </div>
            ) : null}
          </Section>
        </div>

        <aside id="contact" aria-label="Contact and actions" className="scroll-mt-20 lg:row-span-2">
          <div className="sticky top-20 flex flex-col gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-3xl font-bold text-navy-900">
                {usesRooms ? <span className="text-base font-medium text-muted-foreground">From </span> : null}
                {rent.amount}
                <span className="text-base font-medium text-muted-foreground"> {rent.suffix}</span>
              </p>
              {property.rentNegotiable ? <p className="text-sm text-emerald-800">Rent negotiable</p> : null}
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CalendarCheck className="size-4" aria-hidden="true" />
                {formatAvailability(property.availableFrom)}
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                {property.status !== "PUBLISHED" ? (
                  <p className="text-sm text-muted-foreground">Enquiries open once the listing is published.</p>
                ) : property.viewerIsOwner ? (
                  <Button asChild variant="emerald" size="lg">
                    <Link href={`/dashboard/listings/${property.id}`}>Manage this listing</Link>
                  </Button>
                ) : !user ? (
                  <>
                    <Button asChild variant="emerald" size="lg">
                      <Link href={`/login?next=/properties/${property.slug}`}>Log in to send an enquiry</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href={`/register?next=/properties/${property.slug}`}>Create a free tenant account</Link>
                    </Button>
                  </>
                ) : isTenant ? (
                  <>
                    {enquiry ? (
                      <Button asChild variant="emerald" size="lg">
                        <Link href={`/dashboard/messages/${enquiry.id}`}>View your conversation</Link>
                      </Button>
                    ) : (
                      <EnquiryDialog propertyId={property.id} title={property.title} minDate={minDate} />
                    )}
                    {activeViewing ? (
                      <div className="rounded-lg bg-navy-50 p-3 text-sm text-navy-900">
                        Viewing {VIEWING_STATUS_LABELS[activeViewing.status].toLowerCase()}: {formatDateTime(activeViewing.startsAt, timeZone)}.{" "}
                        <Link href="/dashboard/viewings" className="font-semibold underline">
                          Manage
                        </Link>
                      </div>
                    ) : (
                      <ViewingDialog
                        propertyId={property.id}
                        minDate={minDate}
                        timeZoneLabel={`${property.city?.country.name ?? "local"} time`}
                        slots={slots.map((slot) => ({ id: slot.id, label: `${formatDateTime(slot.startsAt, timeZone, { weekday: "short" })}${slot.note ? ` — ${slot.note}` : ""}` }))}
                      />
                    )}
                    <SaveButton propertyId={property.id} initialSaved={favorites.has(property.id)} viewer="tenant" variant="button" />
                  </>
                ) : (
                  <p className="rounded-lg bg-muted p-3 text-sm text-navy-800">
                    You&apos;re signed in as {user.role === "ADMIN" ? "an administrator" : "an owner"}. Enquiries, viewings and saving are available to tenant accounts.
                  </p>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Enquiries and viewing requests are not bookings. Never pay rent or deposits before viewing a property and signing an agreement.</p>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <h2 className="text-sm font-semibold text-muted-foreground">Listed by</h2>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-base font-bold text-white" aria-hidden="true">
                  {property.owner.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{property.owner.companyName ?? property.owner.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {property.owner.companyName ? `${property.owner.name} · Property manager` : "Owner"}
                  </p>
                </div>
              </div>
              {property.owner.bio ? <p className="mt-3 text-sm text-navy-700">{property.owner.bio}</p> : null}
              <p className="mt-3 text-xs text-muted-foreground">Member since {formatDate(property.owner.createdAt, { day: undefined })}</p>
              {property.owner.isDemo ? <p className="mt-2 text-xs font-medium text-amber-800">Demo account</p> : null}
            </div>

            {property.status === "PUBLISHED" && user && !property.viewerIsOwner ? (
              openReport ? (
                <p className="px-2 text-sm text-muted-foreground">You reported this listing. Our team will review it.</p>
              ) : (
                <ReportDialog propertyId={property.id} />
              )
            ) : property.status === "PUBLISHED" && !user ? (
              <Link href={`/login?next=/properties/${property.slug}`} className="px-2 text-sm text-muted-foreground hover:underline">
                Log in to report this listing
              </Link>
            ) : null}
          </div>
        </aside>
      </div>

      {property.status === "PUBLISHED" && !property.viewerIsOwner ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
          <p className="min-w-0 truncate font-bold text-navy-900">
            {rent.amount} <span className="text-sm font-normal text-muted-foreground">{rent.suffix}</span>
          </p>
          <Button asChild variant="emerald">
            <a href="#contact">{isTenant ? "Enquire or view" : "Contact owner"}</a>
          </Button>
        </div>
      ) : null}

      {related.length ? (
        <section aria-labelledby="related-heading" className="mt-14 mb-16 lg:mb-0">
          <h2 id="related-heading" className="text-2xl font-bold">
            More available rentals in {property.city?.name}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((listing) => (
              <ListingCard key={listing.id} listing={listing} saved={relatedFavorites.has(listing.id)} viewer={viewerKind(user)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
