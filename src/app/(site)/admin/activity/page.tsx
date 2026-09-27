import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/misc";
import { Pagination } from "@/components/common/pagination";
import { requirePageUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getActivityLog } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Activity log" };

const TYPES = ["Property", "User", "Report", "City", "Neighborhood", "Country", "PropertyCategory", "Amenity", "SiteSetting"];
const TYPE_LABELS: Record<string, string> = { Property: "Listings", User: "Users", Report: "Reports", City: "Cities", Neighborhood: "Areas", Country: "Countries", PropertyCategory: "Categories", Amenity: "Amenities", SiteSetting: "Settings" };

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requirePageUser(["ADMIN"], "/admin/activity");
  const params = await searchParams;
  const type = TYPES.includes(params.type as string) ? (params.type as string) : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getActivityLog(page, type);

  return (
    <>
      <PageHeader title="Activity log" description={`${total} administrative change${total === 1 ? "" : "s"} recorded. Entries can't be edited or deleted from the dashboard.`} />
      <nav aria-label="Filter by type" className="mt-5 flex flex-wrap gap-2">
        {[undefined, ...TYPES].map((t) => (
          <Link
            key={t ?? "all"}
            href={t ? `/admin/activity?type=${t}` : "/admin/activity"}
            aria-current={t === type ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold", t === type ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
          >
            {t ? TYPE_LABELS[t] : "All"}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Administrative activity</caption>
            <thead className="bg-muted text-navy-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Who</th>
                <th scope="col" className="px-4 py-3 font-semibold">What</th>
                <th scope="col" className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-4 py-3">{entry.actor ? `${entry.actor.name}` : "System / CLI"}</td>
                  <td className="px-4 py-3 text-navy-900">{entry.summary}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{entry.action}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState className="mt-6" icon={History} title="No activity yet" description="Approvals, role changes, report outcomes and catalogue edits will be recorded here." />
      )}
      <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => `/admin/activity?${type ? `type=${type}&` : ""}page=${p}`} />
    </>
  );
}
