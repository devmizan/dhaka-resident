import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { accountLinks } from "@/components/layout/nav-config";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin | Dhaka Resident" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/dashboard?denied=1");

  const [pending, reports, unread] = await Promise.all([
    db.property.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const links = accountLinks("ADMIN").map((link) => ({
    ...link,
    count: link.href.startsWith("/admin/listings") ? pending : link.href === "/admin/reports" ? reports : link.href === "/dashboard/notifications" ? unread : undefined,
  }));

  return (
    <DashboardShell links={links} heading="Administration">
      {children}
    </DashboardShell>
  );
}
