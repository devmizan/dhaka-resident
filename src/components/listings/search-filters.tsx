"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AMENITY_GROUP_LABELS, FURNISHING_LABELS } from "@/lib/labels";
import { buildSearchQuery, SORT_OPTIONS, type SearchFilters, type SortOption } from "@/lib/search-params";
import type { SearchFacets } from "@/server/queries/listings";
import { cn } from "@/lib/utils";

type Draft = SearchFilters;

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none md:h-10 md:text-sm";
const inputClass = selectClass;

function toInt(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

function useSearchNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const navigate = (filters: Partial<SearchFilters>) => {
    const query = buildSearchQuery(filters);
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { navigate, pending };
}

function FilterFields({ draft, setDraft, facets }: { draft: Draft; setDraft: (d: Draft) => void; facets: SearchFacets }) {
  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch, page: 1 });
  const areas = facets.cities.find((c) => c.slug === draft.city)?.neighborhoods ?? [];
  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const groups = Object.keys(AMENITY_GROUP_LABELS) as (keyof typeof AMENITY_GROUP_LABELS)[];

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold text-navy-900">Location</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Keyword</span>
          <input type="search" className={inputClass} value={draft.q ?? ""} maxLength={100} placeholder="e.g. lake view, near NSU" onChange={(e) => update({ q: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">City</span>
          <select className={selectClass} value={draft.city ?? ""} onChange={(e) => update({ city: e.target.value || undefined, area: undefined })}>
            <option value="">All cities</option>
            {facets.cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Neighbourhood</span>
          <select className={selectClass} value={draft.area ?? ""} disabled={!draft.city} onChange={(e) => update({ area: e.target.value || undefined })}>
            <option value="">{draft.city ? "All areas" : "Choose a city first"}</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-navy-900">Property type</span>
        <select className={selectClass} value={draft.type ?? ""} onChange={(e) => update({ type: e.target.value || undefined })}>
          <option value="">All types</option>
          {facets.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.pluralName}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold text-navy-900">Rent (৳)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-700">Min</span>
            <input type="number" inputMode="numeric" min={0} step={500} className={inputClass} value={draft.minRent ?? ""} onChange={(e) => update({ minRent: toInt(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-700">Max</span>
            <input type="number" inputMode="numeric" min={0} step={500} className={inputClass} value={draft.maxRent ?? ""} onChange={(e) => update({ maxRent: toInt(e.target.value) })} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Billing period</span>
          <select className={selectClass} value={draft.period ?? ""} onChange={(e) => update({ period: (e.target.value || undefined) as Draft["period"] })}>
            <option value="">Any period</option>
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="DAILY">Daily</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm font-semibold text-navy-900">Rooms</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Bedrooms</span>
          <select className={selectClass} value={draft.beds ?? ""} onChange={(e) => update({ beds: toInt(e.target.value) })}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Bathrooms</span>
          <select className={selectClass} value={draft.baths ?? ""} onChange={(e) => update({ baths: toInt(e.target.value) })}>
            <option value="">Any</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm font-semibold text-navy-900">Floor area (sq ft)</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Min</span>
          <input type="number" inputMode="numeric" min={0} step={50} className={inputClass} value={draft.minArea ?? ""} onChange={(e) => update({ minArea: toInt(e.target.value) })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-700">Max</span>
          <input type="number" inputMode="numeric" min={0} step={50} className={inputClass} value={draft.maxArea ?? ""} onChange={(e) => update({ maxArea: toInt(e.target.value) })} />
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Furnishing</legend>
        <div className="flex flex-col gap-1">
          {(Object.keys(FURNISHING_LABELS) as (keyof typeof FURNISHING_LABELS)[]).map((value) => (
            <CheckRow key={value} label={FURNISHING_LABELS[value]} checked={draft.furnishing.includes(value)} onChange={() => update({ furnishing: toggle(draft.furnishing, value) })} />
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-navy-900">Available by</span>
        <input type="date" className={inputClass} value={draft.available ?? ""} onChange={(e) => update({ available: e.target.value || undefined })} />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Bathroom</legend>
        <div className="flex flex-col gap-1">
          <RadioRow name="bathroom" label="Any" checked={!draft.bathroom} onChange={() => update({ bathroom: undefined })} />
          <RadioRow name="bathroom" label="Private bathroom" checked={draft.bathroom === "PRIVATE"} onChange={() => update({ bathroom: "PRIVATE" })} />
          <RadioRow name="bathroom" label="Shared bathroom" checked={draft.bathroom === "SHARED"} onChange={() => update({ bathroom: "SHARED" })} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Pets</legend>
        <div className="flex flex-col gap-1">
          <RadioRow name="pets" label="Any policy" checked={!draft.pets} onChange={() => update({ pets: undefined })} />
          <RadioRow name="pets" label="Pets allowed" checked={draft.pets === "allowed"} onChange={() => update({ pets: "allowed" })} />
          <RadioRow name="pets" label="Allowed or negotiable" checked={draft.pets === "considered"} onChange={() => update({ pets: "considered" })} />
        </div>
      </fieldset>

      {groups.map((group) => {
        const amenities = facets.amenities.filter((a) => a.group === group);
        if (!amenities.length) return null;
        return (
          <fieldset key={group}>
            <legend className="mb-2 text-sm font-semibold text-navy-900">{group === "ACCESSIBILITY" ? "Accessibility" : `Amenities: ${AMENITY_GROUP_LABELS[group].toLowerCase()}`}</legend>
            <div className="flex flex-col gap-1">
              {amenities.map((amenity) => (
                <CheckRow key={amenity.slug} label={amenity.name} checked={draft.amenities.includes(amenity.slug)} onChange={() => update({ amenities: toggle(draft.amenities, amenity.slug) })} />
              ))}
            </div>
          </fieldset>
        );
      })}

      <CheckRow label="Hide sample listings" checked={draft.hideDemo} onChange={() => update({ hideDemo: !draft.hideDemo })} />
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-navy-800 hover:bg-navy-50">
      <input type="checkbox" className="size-5 accent-emerald-700" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function RadioRow({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-navy-800 hover:bg-navy-50">
      <input type="radio" name={name} className="size-5 accent-emerald-700" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

const EMPTY: Omit<SearchFilters, "sort" | "page"> = { furnishing: [], amenities: [], hideDemo: false };

/** Desktop sidebar: filters apply as soon as they change (debounced for text/number inputs). */
export function FilterSidebar({ filters, facets }: { filters: SearchFilters; facets: SearchFacets }) {
  const [draft, setDraft] = useState<Draft>(filters);
  const { navigate, pending } = useSearchNavigation();
  const serialized = buildSearchQuery(filters);

  // When the URL changes from elsewhere (chips, back button, reset), adopt it as the new draft.
  // Changes that this sidebar navigated to itself are skipped so in-progress typing isn't lost.
  const [lastSeen, setLastSeen] = useState(serialized);
  const [ownQuery, setOwnQuery] = useState<string | null>(null);
  if (lastSeen !== serialized) {
    setLastSeen(serialized);
    if (serialized !== ownQuery) setDraft(filters);
  }

  useEffect(() => {
    const query = buildSearchQuery(draft);
    if (query === serialized) return;
    const timer = setTimeout(() => {
      setOwnQuery(query);
      navigate(draft);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <aside aria-label="Search filters" className="hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border bg-white p-5 pr-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            Filters {pending ? <Loader2 className="size-4 animate-spin text-emerald-700" aria-label="Updating results" /> : null}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate({ ...EMPTY, sort: filters.sort })}>
            <RotateCcw data-icon="inline-start" />
            Reset filters
          </Button>
        </div>
        <FilterFields draft={draft} setDraft={setDraft} facets={facets} />
      </div>
    </aside>
  );
}

/** Mobile drawer: filters apply when the user taps "Show results". */
export function MobileFilterDrawer({ filters, facets, activeCount, total }: { filters: SearchFilters; facets: SearchFacets; activeCount: number; total: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(filters);
  const { navigate } = useSearchNavigation();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(filters);
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 lg:hidden">
          <SlidersHorizontal data-icon="inline-start" />
          Filters{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>{total.toLocaleString("en-US")} results with current filters</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterFields draft={draft} setDraft={setDraft} facets={facets} />
        </div>
        <SheetFooter className="grid grid-cols-2 gap-3 border-t px-5 py-4">
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              navigate({ ...EMPTY, sort: filters.sort });
              setOpen(false);
            }}
          >
            Reset filters
          </Button>
          <Button
            variant="emerald"
            className="h-12"
            onClick={() => {
              navigate({ ...draft, page: 1 });
              setOpen(false);
            }}
          >
            Show results
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function SortSelect({ filters, className }: { filters: SearchFilters; className?: string }) {
  const { navigate, pending } = useSearchNavigation();
  return (
    <label className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="shrink-0 text-muted-foreground">Sort by</span>
      <select
        className="h-11 rounded-lg border border-input bg-white px-3 text-sm font-medium text-navy-900 focus-visible:border-emerald-600 focus-visible:outline-none md:h-10"
        value={filters.sort}
        disabled={pending}
        onChange={(e) => navigate({ ...filters, sort: e.target.value as SortOption, page: 1 })}
      >
        {SORT_OPTIONS.filter((o) => o.value !== "relevance" || filters.q || filters.sort === "relevance").map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResetFiltersButton({ sort }: { sort: SortOption }) {
  const { navigate } = useSearchNavigation();
  return (
    <Button variant="emerald" onClick={() => navigate({ ...EMPTY, sort })}>
      <RotateCcw data-icon="inline-start" />
      Reset filters
    </Button>
  );
}
