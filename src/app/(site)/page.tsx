import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, FileCheck2, MapPin, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { Notice } from "@/components/common/misc";
import { NamedIcon } from "@/components/icons";
import { HeroSearch } from "@/components/listings/hero-search";
import { ListingCard, ListingGrid, viewerKind } from "@/components/listings/listing-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { pluralize } from "@/lib/utils";
import { getFavoriteIds, getHomepageData } from "@/server/queries/listings";

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), getHomepageData()]);
  const allIds = [...data.featured, ...data.recent].map((l) => l.id);
  const favorites = await getFavoriteIds(user?.role === "TENANT" ? user.id : undefined, allIds);
  const viewer = viewerKind(user);
  const hasSamples = [...data.featured, ...data.recent].some((l) => l.isDemo);

  return (
    <>
      <section className="relative overflow-hidden bg-navy-900">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.45), transparent 40%), radial-gradient(circle at 85% 0%, rgba(59,130,246,0.25), transparent 35%)",
          }}
        />
        <div className="container-page relative pt-7 pb-7 sm:pt-9">
          <h1 className="max-w-3xl text-2xl font-extrabold text-white sm:text-4xl">
            Find your next place to rent in <span className="text-emerald-400">Bangladesh</span>
          </h1>
          <p className="mt-2 hidden max-w-2xl text-lg text-navy-100 sm:block">
            Apartments, houses, rooms, hostels, sublets and commercial spaces — from owners and managers across Dhaka, Chattogram, Sylhet and beyond.
          </p>
          <div className="mt-4 sm:mt-5">
            <HeroSearch categories={data.categories} />
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-heading" className="border-b bg-white">
        <div className="container-page py-5">
          <h2 id="categories-heading" className="sr-only">
            Browse by property type
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {data.categories.map((category) => (
              <li key={category.id} className="shrink-0">
                <Link
                  href={`/search?type=${category.slug}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-navy-800 transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <NamedIcon name={category.icon} className="size-4 text-emerald-700" />
                  {category.pluralName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page flex flex-col gap-12 py-8">
        {hasSamples ? (
          <Notice className="py-2.5">
            Listings marked <strong>Sample listing</strong> are demonstration content, not real properties.
          </Notice>
        ) : null}

        {data.featured.length ? (
          <section aria-labelledby="featured-heading">
            <SectionHeading id="featured-heading" title="Featured rentals" description="Selected by our team from approved listings." href="/search?sort=relevance" />
            <ListingGrid className="mt-5">
              {data.featured.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} saved={favorites.has(listing.id)} viewer={viewer} priority={index < 2} />
              ))}
            </ListingGrid>
          </section>
        ) : null}

        <section aria-labelledby="recent-heading">
          <SectionHeading id="recent-heading" title="Recently added" description="The newest approved listings." href="/search?sort=newest" />
          {data.recent.length ? (
            <ListingGrid className="mt-5">
              {data.recent.map((listing) => (
                <ListingCard key={listing.id} listing={listing} saved={favorites.has(listing.id)} viewer={viewer} />
              ))}
            </ListingGrid>
          ) : (
            <p className="mt-4 text-muted-foreground">No listings have been published yet.</p>
          )}
        </section>

        {data.popularAreas.length ? (
          <section aria-labelledby="locations-heading">
            <SectionHeading id="locations-heading" title="Popular locations" description="Areas with the most available listings right now." />
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.popularAreas.map((area) => (
                <li key={area.id}>
                  <Link
                    href={`/search?city=${area.city.slug}&area=${area.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 transition-colors hover:border-emerald-600 hover:bg-emerald-50/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                        <MapPin className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy-900">{area.name}</span>
                        <span className="block text-sm text-muted-foreground">{area.city.name}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-emerald-800">{pluralize(area.count, "listing")}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Cities">
              {data.cities.map((city) => (
                <li key={city.id}>
                  <Link href={`/search?city=${city.slug}`} className="inline-flex h-10 items-center rounded-full bg-navy-50 px-4 text-sm font-medium text-navy-800 hover:bg-navy-100">
                    {city.name} <span className="ml-1.5 text-navy-500">({city.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-24 rounded-3xl bg-navy-50 p-6 sm:p-10">
          <h2 id="how-heading" className="text-2xl font-bold sm:text-3xl">
            How Dhaka Resident works
          </h2>
          <p className="mt-2 max-w-2xl text-navy-700">
            We connect tenants with owners and property managers. Enquiries and viewing requests start a conversation — they are not bookings, and no rent is paid through the website.
          </p>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <HowColumn
              title="Finding a rental"
              steps={[
                { icon: Search, title: "Search and filter", text: "Filter by area, budget, rooms, furnishing, amenities, pets and accessibility. Save places you like." },
                { icon: MessageSquare, title: "Send an enquiry", text: "Ask questions and talk to the owner in private messages stored in your dashboard." },
                { icon: CalendarClock, title: "Request a viewing", text: "Pick a time the owner offered, or suggest one. You'll be notified when it's accepted." },
              ]}
            />
            <HowColumn
              title="Listing a property"
              steps={[
                { icon: ClipboardCheck, title: "Create your listing", text: "Add location, rent and fees, amenities, house rules and photos. Save drafts any time." },
                { icon: FileCheck2, title: "We review it", text: "Every listing is checked by our team before it's published to tenants." },
                { icon: ShieldCheck, title: "Manage interest", text: "Reply to enquiries, offer viewing times, accept or decline requests, and mark it rented." },
              ]}
            />
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-navy-900 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Have a property to rent out?</h2>
            <p className="mt-2 max-w-xl text-navy-100">List apartments, rooms, hostel beds or commercial space for free and manage every enquiry in one place.</p>
          </div>
          <Button asChild size="lg" variant="emerald">
            <Link href="/list-your-property">
              Post a property
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}

function SectionHeading({ id, title, description, href }: { id: string; title: string; description?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-bold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">
          View all
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function HowColumn({ title, steps }: { title: string; steps: { icon: typeof Search; title: string; text: string }[] }) {
  return (
    <div>
      <h3 className="text-lg font-bold">{title}</h3>
      <ol className="mt-4 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-2xl bg-white p-4 shadow-xs">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <step.icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-navy-900">
                <span className="text-emerald-700">{index + 1}.</span> {step.title}
              </p>
              <p className="mt-0.5 text-sm text-navy-700">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
