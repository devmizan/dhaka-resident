import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageWindow(page: number, pageCount: number): (number | "…")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageCount, hrefFor, className }: { page: number; pageCount: number; hrefFor: (page: number) => string; className?: string }) {
  if (pageCount <= 1) return null;
  const itemClass = "grid h-11 min-w-11 place-items-center rounded-lg border px-3 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(itemClass, "bg-white hover:bg-navy-50")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(itemClass, "opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pageWindow(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(itemClass, p === page ? "border-navy-900 bg-navy-900 text-white" : "hidden bg-white hover:bg-navy-50 sm:grid")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(itemClass, "bg-white hover:bg-navy-50")} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(itemClass, "opacity-40")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
