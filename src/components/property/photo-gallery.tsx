"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string; altText: string | null };

export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = photos.length;

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  if (count === 0) {
    return <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-muted text-muted-foreground">No photos have been added yet.</div>;
  }

  const current = photos[index]!;
  return (
    <>
      <div className="relative grid gap-2 overflow-hidden rounded-2xl md:grid-cols-4 md:grid-rows-2">
        {photos.slice(0, 5).map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => show(i)}
            className={cn(
              "relative overflow-hidden bg-muted focus-visible:z-10",
              i === 0
                ? cn("aspect-[4/3] md:row-span-2 md:aspect-auto md:min-h-[420px]", count === 1 ? "md:col-span-4" : "md:col-span-2")
                : cn(
                    "hidden aspect-[4/3] md:block md:aspect-auto",
                    count === 2 && "md:col-span-2 md:row-span-2",
                    count === 3 && "md:col-span-2",
                    count === 4 && i === 3 && "md:col-span-2",
                  ),
            )}
            aria-label={`Open photo ${i + 1} of ${count}`}
          >
            <Image
              src={photo.url}
              alt={photo.altText ?? `${title} — photo ${i + 1}`}
              fill
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"}
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => show(0)}
          className="absolute right-3 bottom-3 inline-flex h-10 items-center gap-2 rounded-lg bg-white/95 px-3 text-sm font-semibold text-navy-900 shadow ring-1 ring-black/5 hover:bg-white"
        >
          <Grid2x2 className="size-4" aria-hidden="true" />
          {count} photo{count === 1 ? "" : "s"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] gap-3 border-0 bg-navy-950 p-3 text-white sm:max-w-5xl sm:p-4">
          <DialogTitle className="pr-10 text-sm font-medium text-white">
            {title} — photo {index + 1} of {count}
          </DialogTitle>
          <DialogDescription className="sr-only">Use the left and right arrow keys to move between photos.</DialogDescription>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black sm:aspect-[3/2]">
            <Image src={current.url} alt={current.altText ?? `${title} — photo ${index + 1}`} fill sizes="(min-width: 1024px) 1000px, 100vw" className="object-contain" />
            {count > 1 ? (
              <>
                <button type="button" onClick={prev} className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 hover:bg-white" aria-label="Previous photo">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={next} className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900 hover:bg-white" aria-label="Next photo">
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2", i === index ? "ring-emerald-400" : "opacity-60 ring-transparent hover:opacity-100")}
              >
                <Image src={photo.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
