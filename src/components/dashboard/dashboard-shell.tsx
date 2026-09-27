"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AccountLink } from "@/components/layout/nav-config";
import { NavIcon } from "@/components/layout/nav-icons";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0]!;
  if (path === "/dashboard" || path === "/admin") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function DashboardShell({ links, heading, badge, children }: { links: (AccountLink & { count?: number })[]; heading: string; badge?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="container-page grid flex-1 grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:py-8">
      <aside aria-label={heading} className="min-w-0">
        <div className="lg:sticky lg:top-20">
          <div className="mb-3 hidden items-center gap-2 px-3 lg:flex">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{heading}</p>
            {badge}
          </div>
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50 lg:bg-transparent lg:ring-0",
                  )}
                >
                  <NavIcon name={link.icon} className={cn("size-4", active ? "text-emerald-300" : "text-navy-500")} />
                  {link.label}
                  {link.count ? (
                    <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-bold", active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800")}>{link.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
