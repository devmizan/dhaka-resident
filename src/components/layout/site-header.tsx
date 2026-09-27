import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { accountLinks, PUBLIC_NAV } from "@/components/layout/nav-config";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { getNotificationSummary } from "@/server/queries/notifications";
import { getSiteSettings } from "@/server/services/settings";

export function postPropertyHref(role: string | undefined) {
  if (role === "OWNER") return "/dashboard/listings/new";
  return "/list-your-property";
}

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSiteSettings()]);
  const notifications = user ? await getNotificationSummary(user.id) : null;
  const links = user ? accountLinks(user.role) : [];

  return (
    <>
      {settings.announcement ? (
        <div className="bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white">{settings.announcement}</div>
      ) : null}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container-page flex h-16 items-center gap-4">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user && notifications ? <NotificationBell initial={notifications} /> : null}

            <Button asChild variant="emerald" className="hidden sm:inline-flex">
              <Link href={postPropertyHref(user?.role)}>
                <Plus data-icon="inline-start" />
                Post a property
              </Link>
            </Button>

            {user ? (
              <div className="hidden lg:block">
                <UserMenu name={user.name} email={user.email ?? formatPhone(user.phone)} role={user.role} links={links} />
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Button asChild variant="ghost">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/register">Sign up</Link>
                </Button>
              </div>
            )}

            <MobileNav
              user={user ? { name: user.name, email: user.email ?? formatPhone(user.phone), role: user.role } : null}
              links={links}
              postHref={postPropertyHref(user?.role)}
            />
          </div>
        </div>
      </header>
    </>
  );
}
