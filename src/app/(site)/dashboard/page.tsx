import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarClock, ClipboardList, FilePen, Heart, MessageSquare, Plus, Search } from "lucide-react";
import { Notice, PageHeader, StatCard, ViewingStatusBadge } from "@/components/common/misc";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getOwnerOverview, getTenantOverview } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requirePageUser(undefined, "/dashboard");
  const params = await searchParams;
  if (user.role === "ADMIN") redirect("/admin");

  const banners = (
    <>
      {params.welcome === "1" ? (
        <Notice className="mb-6" title={`Welcome to Dhaka Resident, ${user.name.split(" ")[0]}!`}>
          Your account is ready. Start by searching for a place and saving the ones you like.
        </Notice>
      ) : null}
      {params.denied === "1" ? (
        <Notice tone="warning" className="mb-6" title="That page isn't available for your account">
          You were redirected to your dashboard.
        </Notice>
      ) : null}
    </>
  );

  if (user.role === "OWNER") {
    const data = await getOwnerOverview(user.id);
    return (
      <>
        {banners}
        <PageHeader
          title={`Hello, ${user.name.split(" ")[0]}`}
          description="Here's what's happening with your listings."
          actions={
            <Button asChild variant="emerald">
              <Link href="/dashboard/listings/new">
                <Plus data-icon="inline-start" />
                New listing
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Live listings" value={data.published} icon={Building2} href="/dashboard/listings?status=PUBLISHED" />
          <StatCard label="Awaiting approval" value={data.pending} icon={ClipboardList} href="/dashboard/listings?status=PENDING_REVIEW" />
          <StatCard label="Open enquiries" value={data.openEnquiries} icon={MessageSquare} href="/dashboard/messages" />
          <StatCard label="Viewing requests to answer" value={data.pendingViewings} icon={CalendarClock} href="/dashboard/viewings" />
        </div>
        {data.drafts ? (
          <Notice className="mt-6" title={`${data.drafts} listing${data.drafts === 1 ? "" : "s"} need${data.drafts === 1 ? "s" : ""} your attention`}>
            Finish drafts or make requested changes, then submit them for approval.{" "}
            <Link href="/dashboard/listings" className="font-semibold underline">
              Go to my listings
            </Link>
          </Notice>
        ) : null}
        <section className="mt-8">
          <h2 className="text-lg font-bold">Upcoming confirmed viewings</h2>
          {data.upcoming.length ? (
            <ul className="mt-3 divide-y rounded-2xl border bg-white">
              {data.upcoming.map((v) => (
                <li key={v.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-navy-900">{v.property.title}</p>
                    <p className="text-sm text-muted-foreground">with {v.tenant.name}</p>
                  </div>
                  <p className="text-sm font-medium text-navy-800">{formatDateTime(v.startsAt, v.property.city?.country.timeZone)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No confirmed viewings yet. Offer viewing times from a listing&apos;s management page.</p>
          )}
        </section>
        {data.total === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
            <FilePen className="mx-auto size-8 text-navy-500" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">Create your first listing</h2>
            <p className="mt-1 text-sm text-muted-foreground">It takes about 10 minutes. You can save a draft and come back any time.</p>
            <Button asChild variant="emerald" className="mt-4">
              <Link href="/dashboard/listings/new">Start a listing</Link>
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  const data = await getTenantOverview(user.id);
  return (
    <>
      {banners}
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Track the places you're interested in."
        actions={
          <Button asChild variant="emerald">
            <Link href="/search">
              <Search data-icon="inline-start" />
              Search rentals
            </Link>
          </Button>
        }
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Saved properties" value={data.saved} icon={Heart} href="/dashboard/saved" />
        <StatCard label="Conversations" value={data.enquiries} icon={MessageSquare} href="/dashboard/messages" />
        <StatCard label="Pending viewing requests" value={data.pending} icon={CalendarClock} href="/dashboard/viewings" />
      </div>
      <section className="mt-8">
        <h2 className="text-lg font-bold">Upcoming viewings</h2>
        {data.upcoming.length ? (
          <ul className="mt-3 divide-y rounded-2xl border bg-white">
            {data.upcoming.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/properties/${v.property.slug}`} className="font-semibold text-navy-900 hover:underline">
                    {v.property.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{formatDateTime(v.startsAt, v.property.city?.country.timeZone)}</p>
                </div>
                <ViewingStatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">You have no upcoming viewings. Request one from any listing page.</p>
        )}
      </section>
    </>
  );
}
