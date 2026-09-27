import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, X } from "lucide-react";
import { Pagination } from "@/components/common/pagination";
import { ListingCard, viewerKind } from "@/components/listings/listing-card";
import { FilterSidebar, MobileFilterDrawer, ResetFiltersButton, SortSelect } from "@/components/listings/search-filters";
import { getCurrentUser } from "@/lib/auth/session";
import { BILLING_PERIOD_LABELS, FURNISHING_LABELS } from "@/lib/labels";
import { buildSearchQuery, countActiveFilters, parseSearchParams, type SearchFilters } from "@/lib/search-params";
import { formatDate, formatMoney } from "@/lib/format";
import { getFavoriteIds, getSearchFacets, searchListings, type SearchFacets } from "@/server/queries/listings";

function describe(filters: SearchFilters, facets: SearchFacets) {
  const category = facets.categories.find((c) => c.slug === filters.type);
  const city = facets.cities.find((c) => c.slug === filters.city);
  const area = city?.neighborhoods.find((a) => a.slug === filters.area);
  const what = category?.pluralName ?? "Rentals";
  const where = area ? `${area.name}, ${city!.name}` : (city?.name ?? "Bangladesh");
  return { title: `${what} for rent in ${where}`, category, city, area };
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const filters = parseSearchParams(await searchParams);
  const facets = await getSearchFacets();
  const { title } = describe(filters, facets);
  const query = buildSearchQuery({ city: filters.city, area: filters.area, type: filters.type });
  return {
    title: filters.q ? `“${filters.q}” — ${title}` : title,
    description: `Browse ${title.toLowerCase()} on Dhaka Resident. Filter by rent, rooms, furnishing, amenities and availability.`,
    alternates: { canonical: `/search${query ? `?${query}` : ""}` },
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const filters = parseSearchParams(await searchParams);
  const [user, facets, results] = await Promise.all([getCurrentUser(), getSearchFacets(), searchListings(filters)]);
  const favorites = await getFavoriteIds(user?.role === "TENANT" ? user.id : undefined, results.items.map((i) => i.id));
  const { title, category, city, area } = describe(filters, facets);
  const activeCount = countActiveFilters(filters) + (filters.q ? 1 : 0);

  const chips: { label: string; remove: Partial<SearchFilters> }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, remove: { q: undefined } });
  if (city) chips.push({ label: city.name, remove: { city: undefined, area: undefined } });
  if (area) chips.push({ label: area.name, remove: { area: undefined } });
  if (category) chips.push({ label: category.pluralName, remove: { type: undefined } });
  if (filters.minRent !== undefined) chips.push({ label: `From ${formatMoney(filters.minRent)}`, remove: { minRent: undefined } });
  if (filters.maxRent !== undefined) chips.push({ label: `Up to ${formatMoney(filters.maxRent)}`, remove: { maxRent: undefined } });
  if (filters.period) chips.push({ label: BILLING_PERIOD_LABELS[filters.period], remove: { period: undefined } });
  if (filters.beds !== undefined) chips.push({ label: `${filters.beds}+ bedrooms`, remove: { beds: undefined } });
  if (filters.baths !== undefined) chips.push({ label: `${filters.baths}+ bathrooms`, remove: { baths: undefined } });
  if (filters.minArea !== undefined) chips.push({ label: `≥ ${filters.minArea} sq ft`, remove: { minArea: undefined } });
  if (filters.maxArea !== undefined) chips.push({ label: `≤ ${filters.maxArea} sq ft`, remove: { maxArea: undefined } });
  for (const f of filters.furnishing) chips.push({ label: FURNISHING_LABELS[f], remove: { furnishing: filters.furnishing.filter((x) => x !== f) } });
  if (filters.available) chips.push({ label: `Available by ${formatDate(filters.available)}`, remove: { available: undefined } });
  if (filters.bathroom) chips.push({ label: filters.bathroom === "PRIVATE" ? "Private bathroom" : "Shared bathroom", remove: { bathroom: undefined } });
  if (filters.pets) chips.push({ label: filters.pets === "allowed" ? "Pets allowed" : "Pets considered", remove: { pets: undefined } });
  for (const slug of filters.amenities) {
    const amenity = facets.amenities.find((a) => a.slug === slug);
    if (amenity) chips.push({ label: amenity.name, remove: { amenities: filters.amenities.filter((a) => a !== slug) } });
  }
  if (filters.hideDemo) chips.push({ label: "Hiding sample listings", remove: { hideDemo: false } });

  const hrefWith = (overrides: Partial<SearchFilters>) => {
    const query = buildSearchQuery(filters, { page: 1, ...overrides });
    return query ? `/search?${query}` : "/search";
  };

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <FilterSidebar filters={filters} facets={facets} />

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 id="results-heading" className="text-2xl font-bold sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-muted-foreground" aria-live="polite">
                {results.total === 0
                  ? "No listings match your filters"
                  : `${results.total.toLocaleString("en-US")} listing${results.total === 1 ? "" : "s"} · page ${results.page} of ${results.pageCount}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MobileFilterDrawer filters={filters} facets={facets} activeCount={activeCount} total={results.total} />
              <SortSelect filters={filters} />
            </div>
          </div>

          {chips.length ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <Link
                    href={hrefWith(chip.remove)}
                    scroll={false}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy-50 pr-2 pl-3 text-sm font-medium text-navy-800 hover:bg-navy-100"
                    aria-label={`Remove filter: ${chip.label}`}
                  >
                    {chip.label}
                    <X className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={filters.sort === "newest" ? "/search" : `/search?sort=${filters.sort}`} scroll={false} className="inline-flex h-9 items-center px-2 text-sm font-semibold text-emerald-700 hover:underline">
                  Reset filters
                </Link>
              </li>
            </ul>
          ) : null}

          {results.items.length ? (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.items.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} saved={favorites.has(listing.id)} viewer={viewerKind(user)} priority={index < 3} />
                ))}
              </div>
              <Pagination
                className="mt-10"
                page={results.page}
                pageCount={results.pageCount}
                hrefFor={(page) => {
                  const query = buildSearchQuery(filters, { page });
                  return query ? `/search?${query}` : "/search";
                }}
              />
            </>
          ) : (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed bg-muted/40 px-6 py-14 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-white shadow-sm">
                <SearchX className="size-6 text-navy-600" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No rentals match these filters</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Try removing a filter, widening your budget, or searching a nearby area.</p>
              <div className="mt-5">
                <ResetFiltersButton sort={filters.sort === "relevance" ? "newest" : filters.sort} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
