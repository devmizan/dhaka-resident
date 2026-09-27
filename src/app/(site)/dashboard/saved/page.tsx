import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/misc";
import { ListingCard } from "@/components/listings/listing-card";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { getSavedListings } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Saved properties" };

export default async function SavedPage() {
  const user = await requirePageUser(["TENANT"], "/dashboard/saved");
  const saved = await getSavedListings(user.id);
  const available = saved.filter((s) => s.available);
  const unavailable = saved.filter((s) => !s.available);

  return (
    <>
      <PageHeader title="Saved properties" description={`${available.length} saved listing${available.length === 1 ? "" : "s"} available`} />
      {available.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {available.map(({ listing }) => (
            <ListingCard key={listing.id} listing={listing} saved viewer="tenant" />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon={Heart}
          title="No saved properties yet"
          description="Tap the heart on any listing to keep track of it here."
          action={
            <Button asChild variant="emerald">
              <Link href="/search">Browse rentals</Link>
            </Button>
          }
        />
      )}
      {unavailable.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold">No longer available</h2>
          <p className="text-sm text-muted-foreground">These listings were rented, paused or removed.</p>
          <ul className="mt-3 divide-y rounded-2xl border bg-white">
            {unavailable.map(({ listing }) => (
              <li key={listing.id} className="p-4 text-sm text-navy-800">
                {listing.title} <span className="text-muted-foreground">· {listing.locationLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
