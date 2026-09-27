"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Plus } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PUBLIC_NAV, type AccountLink } from "@/components/layout/nav-config";
import { NavIcon } from "@/components/layout/nav-icons";
import { ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

export function MobileNav({
  user,
  links,
  postHref,
}: {
  user: { name: string; email: string; role: Role } | null;
  links: AccountLink[];
  postHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  const items = user ? links : [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className={user ? undefined : "sr-only"}>
            {user ? `${user.name} · ${ROLE_LABELS[user.role]}` : "Site navigation"}
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
          <Button asChild variant="emerald" className="mb-2 h-12 justify-center">
            <Link href={postHref} onClick={close}>
              <Plus data-icon="inline-start" />
              Post a property
            </Link>
          </Button>
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-base font-medium text-navy-800 hover:bg-navy-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          {user ? (
            <>
              <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your account</p>
              {items.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  aria-current={pathname === link.href.split("?")[0] ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-base text-navy-800 hover:bg-navy-50",
                    pathname === link.href.split("?")[0] && "bg-navy-50 font-semibold",
                  )}
                >
                  <NavIcon name={link.icon} className="size-5 text-navy-500" />
                  {link.label}
                </Link>
              ))}
              <form action={logoutAction}>
                <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base text-red-700 hover:bg-red-50">
                  <LogOut className="size-5" aria-hidden="true" />
                  Log out
                </button>
              </form>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1">
              <Button asChild variant="outline" className="h-12">
                <Link href="/login" onClick={close}>
                  Log in
                </Link>
              </Button>
              <Button asChild className="h-12">
                <Link href="/register" onClick={close}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
