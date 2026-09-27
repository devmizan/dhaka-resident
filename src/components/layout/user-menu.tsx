"use client";

import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountLink } from "@/components/layout/nav-config";
import { NavIcon } from "@/components/layout/nav-icons";
import { ROLE_LABELS } from "@/lib/labels";
import { initials } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

export function UserMenu({ name, email, role, links }: { name: string; email: string; role: Role; links: AccountLink[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span className="grid size-8 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">{initials(name)}</span>
          <span className="max-w-28 truncate text-sm">{name.split(" ")[0]}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold text-navy-900">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs font-medium text-emerald-700">{ROLE_LABELS[role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>
              <NavIcon name={link.icon} className="size-4" />
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut className="size-4" />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
