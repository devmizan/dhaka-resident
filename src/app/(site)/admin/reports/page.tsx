import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import type { ReportStatus } from "@/generated/prisma/enums";
import { ListingModerationActions, ResolveReportDialog } from "@/components/admin/admin-actions";
import { EmptyState, ListingStatusBadge, PageHeader, SampleBadge } from "@/components/common/misc";
import { Pagination } from "@/components/common/pagination";
import { requirePageUser } from "@/lib/auth/session";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAdminReports } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Reports" };

const STATUSES = Object.keys(REPORT_STATUS_LABELS) as ReportStatus[];

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePageUser(["ADMIN"], "/admin/reports");
  const params = await searchParams;
  const status = params.status === "all" ? undefined : STATUSES.includes(params.status as ReportStatus) ? (params.status as ReportStatus) : "OPEN";
  const page = Math.max(1, Number(params.page) || 1);
  const { items, pageCount, counts } = await getAdminReports(status, page);

  return (
    <>
      <PageHeader title="Reported listings" description="Review reports from users and take action on listings when needed." />
      <nav aria-label="Filter reports" className="mt-5 flex flex-wrap gap-2">
        {[...STATUSES, "all" as const].map((s) => {
          const active = s === "all" ? !status : s === status;
          return (
            <Link
              key={s}
              href={s === "OPEN" ? "/admin/reports" : `/admin/reports?status=${s}`}
              aria-current={active ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold", active ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
            >
              {s === "all" ? "All" : REPORT_STATUS_LABELS[s]}
              {s !== "all" ? <span className={active ? "text-navy-200" : "text-muted-foreground"}>{counts[s] ?? 0}</span> : null}
            </Link>
          );
        })}
      </nav>

      {items.length ? (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">{REPORT_REASON_LABELS[r.reason]}</span>
                    <span className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</span>
                  </div>
                  <Link href={`/properties/${r.property.slug}`} className="mt-2 block font-semibold text-navy-900 hover:underline">
                    {r.property.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <ListingStatusBadge status={r.property.status} />
                    {r.property.isDemo ? <SampleBadge /> : null}
                    <span>
                      Owner {r.property.owner.name} ({r.property.owner.email ?? r.property.owner.phone})
                    </span>
                  </div>
                  <blockquote className="mt-3 rounded-lg bg-muted p-3 text-sm whitespace-pre-line text-navy-800">{r.details}</blockquote>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reported by {r.reporter.name} ({r.reporter.email ?? r.reporter.phone})
                  </p>
                  {r.status !== "OPEN" ? (
                    <p className="mt-2 text-sm text-navy-800">
                      <span className="font-semibold">{REPORT_STATUS_LABELS[r.status]}</span> by {r.resolvedBy?.name ?? "an admin"}
                      {r.resolvedAt ? ` on ${formatDateTime(r.resolvedAt)}` : ""}: {r.resolutionNote}
                    </p>
                  ) : null}
                </div>
                {r.status === "OPEN" ? (
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <ResolveReportDialog reportId={r.id} listingLive={["PUBLISHED", "PAUSED", "RENTED"].includes(r.property.status)} />
                    <ListingModerationActions propertyId={r.property.id} status={r.property.status} isFeatured={false} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" icon={Flag} title="No reports here" description={status === "OPEN" ? "There are no open reports to review." : "Nothing to show for this filter."} />
      )}
      <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => `/admin/reports?${status ? `status=${status}&` : "status=all&"}page=${p}`} />
    </>
  );
}
