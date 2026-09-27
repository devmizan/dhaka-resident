import type { Metadata } from "next";
import Link from "next/link";
import type { Role } from "@/generated/prisma/enums";
import { UserAdminActions } from "@/components/admin/admin-actions";
import { PageHeader } from "@/components/common/misc";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { getAdminUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Users & roles" };

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requirePageUser(["ADMIN"], "/admin/users");
  const params = await searchParams;
  const role = ROLES.includes(params.role as Role) ? (params.role as Role) : undefined;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total, pageCount } = await getAdminUsers({ role, q, page });
  const href = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ role, q, page: undefined, ...overrides })) if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <>
      <PageHeader title="Users & roles" description={`${total} account${total === 1 ? "" : "s"}. Role changes sign the user out so new permissions apply immediately.`} />
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter by role" className="flex flex-wrap gap-2">
          {[undefined, ...ROLES].map((r) => (
            <Link
              key={r ?? "all"}
              href={href({ role: r })}
              aria-current={r === role ? "page" : undefined}
              className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold", r === role ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
            >
              {r ? ROLE_LABELS[r] : "All"}
            </Link>
          ))}
        </nav>
        <form action="/admin/users" className="flex gap-2" role="search">
          {role ? <input type="hidden" name="role" value={role} /> : null}
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input id="user-search" name="q" defaultValue={q} placeholder="Name, email or mobile" className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm lg:w-64" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Users</caption>
          <thead className="bg-muted text-navy-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">User</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Joined / last login</th>
              <th scope="col" className="px-4 py-3 font-semibold">Listings</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role & actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((user) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy-900">{user.name}</p>
                  {user.email ? (
                    <p className="text-muted-foreground">
                      {user.email}
                      {user.emailVerifiedAt ? <span className="ml-1 text-xs text-emerald-700">✓ verified</span> : null}
                    </p>
                  ) : null}
                  {user.phone ? (
                    <p className="text-muted-foreground">
                      {formatPhone(user.phone)}
                      {user.phoneVerifiedAt ? <span className="ml-1 text-xs text-emerald-700">✓ verified</span> : null}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{user.hasPassword ? "Password + codes" : "Signs in with codes only"}</p>
                  {user.isDemo ? <p className="text-xs font-medium text-amber-800">Demo account</p> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
                    {user.status === "ACTIVE" ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(user.createdAt)}
                  <br />
                  {user.lastLoginAt ? formatRelative(user.lastLoginAt) : "Never"}
                </td>
                <td className="px-4 py-3">{user._count.properties}</td>
                <td className="px-4 py-3">
                  <UserAdminActions userId={user.id} role={user.role} suspended={user.status === "SUSPENDED"} isSelf={user.id === admin.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No users match.</p> : null}
      </div>
      <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => href({ page: p })} />
    </>
  );
}
