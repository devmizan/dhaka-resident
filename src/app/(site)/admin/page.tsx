import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ClipboardCheck, Flag, Users } from "lucide-react";
import { Notice, PageHeader, StatCard } from "@/components/common/misc";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { getAdminOverview } from "@/server/queries/admin";
import { isEmailConfigured } from "@/server/services/email";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requirePageUser(["ADMIN"], "/admin");
  const data = await getAdminOverview();

  return (
    <>
      <PageHeader title="Admin overview" description="Moderate listings, manage users and keep the marketplace healthy." />
      {!isEmailConfigured() ? (
        <Notice tone="warning" className="mt-5" title="Email delivery is not configured">
          SMTP settings are missing, so no emails are being sent (password resets, notifications). Users still see in-app notifications.
          {data.emailsSkipped ? ` ${data.emailsSkipped} email${data.emailsSkipped === 1 ? " was" : "s were"} skipped in the last 7 days.` : ""}{" "}
          <Link href="/admin/settings" className="font-semibold underline">
            See settings
          </Link>
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={data.users.total} icon={Users} href="/admin/users" hint={`${data.users.tenants} tenants · ${data.users.owners} owners · ${data.users.admins} admins`} />
        <StatCard label="Listings" value={data.listings.total} icon={Building2} href="/admin/listings" hint={`${data.listings.published} published`} />
        <StatCard label="Pending approvals" value={data.listings.pending} icon={ClipboardCheck} href="/admin/listings?status=PENDING_REVIEW" />
        <StatCard label="Open reports" value={data.openReports} icon={Flag} href="/admin/reports" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5" aria-labelledby="queue-heading">
          <div className="flex items-center justify-between">
            <h2 id="queue-heading" className="text-lg font-bold">
              Approval queue
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/listings?status=PENDING_REVIEW">Review all</Link>
            </Button>
          </div>
          {data.pendingListings.length ? (
            <ul className="mt-3 divide-y">
              {data.pendingListings.map((listing) => (
                <li key={listing.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{listing.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {listing.category.name} · {listing.city?.name} · by {listing.owner.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{listing.submittedAt ? formatRelative(listing.submittedAt) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nothing waiting for review.</p>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5" aria-labelledby="activity-heading">
          <div className="flex items-center justify-between">
            <h2 id="activity-heading" className="text-lg font-bold">
              Recent admin activity
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/activity">Full log</Link>
            </Button>
          </div>
          {data.recentActivity.length ? (
            <ul className="mt-3 divide-y">
              {data.recentActivity.map((entry) => (
                <li key={entry.id} className="py-3">
                  <p className="text-sm text-navy-900">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor?.name ?? "System"} · {formatRelative(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No administrative changes recorded yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
