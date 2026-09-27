import type { Metadata } from "next";
import Link from "next/link";
import { AmenityForm, CategoryForm, CityForm, CountryForm, NeighborhoodForm } from "@/components/admin/catalogue-forms";
import { NamedIcon } from "@/components/icons";
import { PageHeader } from "@/components/common/misc";
import { requirePageUser } from "@/lib/auth/session";
import { AMENITY_GROUP_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getCatalogue } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Locations & catalogue" };

const TABS = [
  { key: "locations", label: "Locations" },
  { key: "categories", label: "Property categories" },
  { key: "amenities", label: "Amenities" },
] as const;

function Inactive() {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Inactive</span>;
}

export default async function CataloguePage({ searchParams }: PageProps<"/admin/catalogue">) {
  await requirePageUser(["ADMIN"], "/admin/catalogue");
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "locations";
  const { countries, categories, amenities } = await getCatalogue();

  return (
    <>
      <PageHeader title="Locations & catalogue" description="Manage where listings can be placed and how they're described. Items in use can be deactivated instead of deleted." />
      <nav aria-label="Catalogue sections" className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/catalogue?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold", t.key === tab ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "locations" ? (
        <div className="mt-5 flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <CityForm countries={countries.map((c) => ({ id: c.id, name: c.name }))} />
            <CountryForm />
          </div>
          {countries.map((country) => (
            <section key={country.id} className="rounded-2xl border bg-white" aria-labelledby={`country-${country.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <h2 id={`country-${country.id}`} className="text-lg font-bold">
                  {country.name} <span className="text-sm font-normal text-muted-foreground">· {country.currencyCode} ({country.currencySymbol}) · {country.timeZone}</span>
                </h2>
              </div>
              <ul className="divide-y">
                {country.cities.map((city) => (
                  <li key={city.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{city.name}</h3>
                        <span className="text-sm text-muted-foreground">/{city.slug} · {city._count.properties} listings</span>
                        {!city.isActive ? <Inactive /> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <NeighborhoodForm cityId={city.id} cityName={city.name} />
                        <CityForm countries={countries.map((c) => ({ id: c.id, name: c.name }))} city={city} />
                      </div>
                    </div>
                    {city.neighborhoods.length ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {city.neighborhoods.map((area) => (
                          <li key={area.id} className={cn("inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-3 text-sm ring-1", area.isActive ? "bg-navy-50 ring-navy-100" : "bg-slate-50 text-slate-500 line-through ring-slate-200")}>
                            {area.name}
                            <span className="text-xs text-muted-foreground">({area._count.properties})</span>
                            <NeighborhoodForm cityId={city.id} cityName={city.name} area={area} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No areas yet.</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {tab === "categories" ? (
        <section className="mt-5">
          <CategoryForm />
          <ul className="mt-4 divide-y rounded-2xl border bg-white">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <NamedIcon name={category.icon} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                      {category.name} {!category.isActive ? <Inactive /> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      /{category.slug} · {category._count.properties} listings
                      {category.usesRoomTypes ? " · per-bed room types" : ""}
                      {category.isCommercial ? " · commercial" : ""}
                    </p>
                  </div>
                </div>
                <CategoryForm category={category} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "amenities" ? (
        <section className="mt-5">
          <AmenityForm />
          {(Object.keys(AMENITY_GROUP_LABELS) as (keyof typeof AMENITY_GROUP_LABELS)[]).map((group) => (
            <div key={group} className="mt-5">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{AMENITY_GROUP_LABELS[group]}</h2>
              <ul className="mt-2 divide-y rounded-2xl border bg-white">
                {amenities
                  .filter((a) => a.group === group)
                  .map((amenity) => (
                    <li key={amenity.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <NamedIcon name={amenity.icon} className="size-5 text-emerald-700" />
                        <span className="font-medium text-navy-900">{amenity.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {amenity.slug} · {amenity._count.properties} listings
                        </span>
                        {!amenity.isActive ? <Inactive /> : null}
                      </div>
                      <AmenityForm amenity={amenity} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
