"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/server/actions/interactions";

export type ViewerKind = "guest" | "tenant" | "other";

export function SaveButton({
  propertyId,
  initialSaved,
  viewer,
  variant = "overlay",
  className,
}: {
  propertyId: string;
  initialSaved: boolean;
  viewer: ViewerKind;
  variant?: "overlay" | "button";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (viewer === "guest") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (viewer === "other") {
      toast.info("Saving properties is available for tenant accounts.");
      return;
    }
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleFavoriteAction(propertyId, next);
      if (!result.ok) {
        setSaved(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "Saved to your list" : "Removed from saved");
      }
    });
  }

  const label = saved ? "Remove from saved properties" : "Save property";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={saved}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
          saved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-white text-navy-900 hover:bg-navy-50",
          className,
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} aria-hidden="true" />
        {saved ? "Saved" : "Save property"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "relative z-10 grid size-10 place-items-center rounded-full bg-white/95 text-navy-900 shadow-sm ring-1 ring-black/5 transition hover:scale-105 disabled:opacity-70",
        className,
      )}
    >
      <Heart className={cn("size-5", saved && "fill-rose-500 text-rose-500")} aria-hidden="true" />
    </button>
  );
}
