import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { accountLinks } from "@/components/layout/nav-config";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardCounts } from "@/server/queries/dashboard";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const counts = await getDashboardCounts(user);
  const links = accountLinks(user.role).map((link) => ({
    ...link,
    count: link.href === "/dashboard/messages" ? counts.unreadConversations : link.href === "/dashboard/viewings" ? counts.pendingViewings : link.href === "/dashboard/notifications" ? counts.unreadNotifications : undefined,
  }));
  return (
    <DashboardShell links={links} heading={user.role === "ADMIN" ? "Administration" : user.role === "OWNER" ? "Owner dashboard" : "Tenant dashboard"}>
      {children}
    </DashboardShell>
  );
}
