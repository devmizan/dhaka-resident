import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, ExternalLink } from "lucide-react";
import { ListingStatusBadge, Notice } from "@/components/common/misc";
import { ListingStatusControls } from "@/components/owner/listing-status-controls";
import { PhotoManager } from "@/components/owner/photo-manager";
import { AmenitiesStepForm, DetailsStepForm, LocationStepForm, PricingStepForm, TypeStepForm } from "@/components/owner/step-forms";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { toCalendarDateString } from "@/lib/dates";
import { listingCompleteness } from "@/lib/listing-completeness";
import { isEditRequiringReview } from "@/lib/listing-status";
import { ADDRESS_VISIBILITY_LABELS, BILLING_PERIOD_SHORT, FURNISHING_LABELS, PET_POLICY_LABELS, TENANT_PREFERENCE_LABELS } from "@/lib/labels";
import { formatAvailability, formatMoney, formatRent } from "@/lib/format";
import { LISTING_STEPS, type ListingStepKey } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";
import { getEditorReferenceData, getListingForEditor } from "@/server/queries/owner";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingStepPage({ params }: PageProps<"/dashboard/listings/[id]/edit/[step]">) {
  const { id, step: rawStep } = await params;
  const user = await requirePageUser(["OWNER"], `/dashboard/listings/${id}/edit/${rawStep}`);
  const step = LISTING_STEPS.find((s) => s.key === rawStep)?.key as ListingStepKey | undefined;
  if (!step) notFound();
  const [listing, refs] = await Promise.all([getListingForEditor(user.id, id), getEditorReferenceData()]);
  if (!listing) notFound();

  const stepIndex = LISTING_STEPS.findIndex((s) => s.key === step);
  const missing = listingCompleteness({
    cityId: listing.cityId,
    title: listing.title,
    description: listing.description,
    availableFrom: listing.availableFrom,
    rentAmount: listing.rentAmount,
    usesRoomTypes: listing.category.usesRoomTypes,
    roomTypeCount: listing.roomTypes.length,
    photoCount: listing.photos.length,
  });
  const incompleteSteps = new Set(missing.map((m) => m.step));
  const nextHref = (key: ListingStepKey) => `/dashboard/listings/${id}/edit/${key}`;

  return (
    <>
      <Link href={`/dashboard/listings/${id}`} className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to listing
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{listing.title || "New listing"}</h1>
        <ListingStatusBadge status={listing.status} />
      </div>

      {isEditRequiringReview(listing.status) ? (
        <Notice tone="warning" className="mt-4" title="This listing has been approved">
          Saving changes to its content sends it back for review, and it will be hidden from tenants until approved again. To update only the available date or free beds, use{" "}
          <Link href={`/dashboard/listings/${id}`} className="font-semibold underline">
            quick availability updates
          </Link>
          .
        </Notice>
      ) : null}
      {listing.status === "REJECTED" || listing.status === "UNPUBLISHED" ? (
        <Notice tone="warning" className="mt-4" title="Changes requested by our team">
          {listing.rejectionReason}
        </Notice>
      ) : null}

      <nav aria-label="Listing steps" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-2">
          {LISTING_STEPS.map((s, index) => {
            const active = s.key === step;
            const incomplete = incompleteSteps.has(s.key);
            return (
              <li key={s.key}>
                <Link
                  href={nextHref(s.key)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full pr-4 pl-2 text-sm font-medium",
                    active ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50",
                  )}
                >
                  <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", active ? "bg-emerald-500 text-navy-950" : incomplete ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800")}>
                    {!active && !incomplete && s.key !== "review" ? <Check className="size-4" aria-label="complete" /> : index + 1}
                  </span>
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="mt-5 rounded-2xl border bg-white px-5 pt-5 sm:px-6 sm:pt-6" aria-labelledby="step-heading">
        <h2 id="step-heading" className="mb-4 text-xl font-bold">
          Step {stepIndex + 1}: {LISTING_STEPS[stepIndex]!.label}
        </h2>

        {step === "type" ? (
          <div className="pb-6">
            <TypeStepForm categories={refs.categories} propertyId={id} currentCategoryId={listing.categoryId} />
          </div>
        ) : null}

        {step === "location" ? (
          <LocationStepForm
            propertyId={id}
            cities={refs.cities}
            defaults={{
              cityId: listing.cityId,
              neighborhoodId: listing.neighborhoodId,
              approximateArea: listing.approximateArea,
              addressLine: listing.addressLine,
              latitude: listing.latitude,
              longitude: listing.longitude,
              addressVisibility: listing.addressVisibility,
            }}
          />
        ) : null}

        {step === "details" ? (
          <DetailsStepForm
            propertyId={id}
            usesRoomTypes={listing.category.usesRoomTypes}
            isCommercial={listing.category.isCommercial}
            defaults={{
              title: listing.title,
              description: listing.description,
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              floorAreaSqft: listing.floorAreaSqft,
              floorNumber: listing.floorNumber,
              totalFloors: listing.totalFloors,
              furnishing: listing.furnishing,
              bathroomType: listing.bathroomType,
              availableFrom: toCalendarDateString(listing.availableFrom),
              minimumStay: listing.minimumStay,
              tenantPreference: listing.tenantPreference,
              includedFacilities: listing.includedFacilities,
              roomTypes: listing.roomTypes,
            }}
          />
        ) : null}

        {step === "pricing" ? (
          <PricingStepForm
            propertyId={id}
            usesRoomTypes={listing.category.usesRoomTypes}
            roomPriceSummary={
              listing.roomTypes.length
                ? listing.roomTypes.map((r) => `${r.name}: ${formatMoney(r.pricePerBed, listing.currencyCode)} / ${BILLING_PERIOD_SHORT[r.billingPeriod]}`).join(" · ")
                : null
            }
            defaults={{
              rentAmount: listing.rentAmount,
              billingPeriod: listing.billingPeriod,
              rentNegotiable: listing.rentNegotiable,
              securityDeposit: listing.securityDeposit,
              advanceRentMonths: listing.advanceRentMonths,
              serviceCharge: listing.serviceCharge,
              utilitiesIncluded: listing.utilitiesIncluded,
              utilitiesNote: listing.utilitiesNote,
              otherFees: listing.otherFees,
            }}
          />
        ) : null}

        {step === "amenities" ? (
          <AmenitiesStepForm
            propertyId={id}
            amenities={refs.amenities}
            defaults={{ amenityIds: listing.amenities.map((a) => a.amenityId), petPolicy: listing.petPolicy, smokingAllowed: listing.smokingAllowed, houseRules: listing.houseRules }}
          />
        ) : null}

        {step === "photos" ? (
          <div className="pb-6">
            <PhotoManager propertyId={id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url, altText: p.altText }))} nextHref={nextHref("review")} />
          </div>
        ) : null}

        {step === "review" ? (
          <div className="flex flex-col gap-6 pb-6">
            {missing.length ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-amber-950">
                  <CircleAlert className="size-5" aria-hidden="true" />
                  Complete these before submitting
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {missing.map((item) => (
                    <li key={item.message}>
                      <Link href={nextHref(item.step)} className="text-amber-950 underline">
                        {item.message}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-900">
                <Check className="size-5" aria-hidden="true" />
                Everything required is filled in.
              </p>
            )}

            <div className="overflow-hidden rounded-2xl border">
              <div className="grid gap-0 md:grid-cols-[280px_1fr]">
                <div className="relative aspect-[4/3] bg-muted md:aspect-auto">
                  {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="280px" className="object-cover" /> : <span className="grid h-full place-items-center text-sm text-muted-foreground">No photos yet</span>}
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">{listing.category.name}</p>
                  <h3 className="mt-1 text-lg font-bold">{listing.title || "Untitled"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[listing.approximateArea, listing.neighborhood?.name, listing.city?.name].filter(Boolean).join(", ") || "Location not set"}
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {listing.rentAmount ? (
                      <>
                        {listing.category.usesRoomTypes ? "From " : ""}
                        {formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.category.usesRoomTypes).amount}{" "}
                        <span className="text-sm font-normal text-muted-foreground">{formatRent(listing.rentAmount, listing.billingPeriod, listing.currencyCode, listing.category.usesRoomTypes).suffix}</span>
                      </>
                    ) : (
                      "Rent not set"
                    )}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Availability</dt>
                    <dd>{formatAvailability(listing.availableFrom)}</dd>
                    <dt className="text-muted-foreground">Furnishing</dt>
                    <dd>{listing.furnishing ? FURNISHING_LABELS[listing.furnishing] : "—"}</dd>
                    <dt className="text-muted-foreground">Deposit</dt>
                    <dd>{formatMoney(listing.securityDeposit, listing.currencyCode)}</dd>
                    <dt className="text-muted-foreground">Pets</dt>
                    <dd>{PET_POLICY_LABELS[listing.petPolicy]}</dd>
                    <dt className="text-muted-foreground">Suitable for</dt>
                    <dd>{TENANT_PREFERENCE_LABELS[listing.tenantPreference]}</dd>
                    <dt className="text-muted-foreground">Address</dt>
                    <dd>{ADDRESS_VISIBILITY_LABELS[listing.addressVisibility].replace(/^Show the full address |^Keep the full address /, "")}</dd>
                    <dt className="text-muted-foreground">Photos / amenities</dt>
                    <dd>
                      {listing.photos.length} / {listing.amenities.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              {listing.status !== "DRAFT" || listing.title ? (
                <Button asChild variant="outline">
                  <Link href={`/properties/${listing.slug}`} target="_blank">
                    <ExternalLink data-icon="inline-start" />
                    Preview full listing page
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <ListingStatusControls propertyId={id} status={listing.status} canDelete={false} />
            </div>
            <p className="text-sm text-muted-foreground">After you submit, an administrator reviews the listing. You&apos;ll get a notification when it&apos;s approved or if changes are needed.</p>
          </div>
        ) : null}
      </section>
    </>
  );
}
