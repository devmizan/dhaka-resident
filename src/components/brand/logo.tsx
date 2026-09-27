import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-9", className)} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0c1f38" />
      <path d="M14 30 32 15l18 15v19a3 3 0 0 1-3 3H38V38H26v14h-9a3 3 0 0 1-3-3Z" fill="#fff" />
      <circle cx="32" cy="29" r="5" fill="#10b981" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Dhaka Resident home">
      <LogoMark />
      <span className={cn("text-lg leading-none font-extrabold tracking-tight", inverted ? "text-white" : "text-navy-900")}>
        Dhaka<span className={inverted ? "text-emerald-400" : "text-emerald-700"}>Resident</span>
      </span>
    </Link>
  );
}
