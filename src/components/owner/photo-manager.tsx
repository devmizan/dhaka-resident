"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_PHOTOS, MIN_PHOTOS_TO_SUBMIT } from "@/lib/validation/listing";
import { cn } from "@/lib/utils";
import { removePhotoAction, reorderPhotosAction } from "@/server/actions/listings";

type Photo = { id: string; url: string; altText: string | null };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 10 * 1024 * 1024;

export function PhotoManager({ propertyId, photos: initial, nextHref }: { propertyId: string; photos: Photo[]; nextHref: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initial);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setErrors([`You can add up to ${MAX_PHOTOS} photos.`]);
      return;
    }
    const batch = files.slice(0, room);
    const problems: string[] = files.length > room ? [`Only the first ${room} photo(s) were added — the limit is ${MAX_PHOTOS}.`] : [];
    setUploading({ done: 0, total: batch.length });
    const added: Photo[] = [];
    for (const [index, file] of batch.entries()) {
      if (!ACCEPT.split(",").includes(file.type)) {
        problems.push(`${file.name}: use JPG, PNG, WebP or AVIF.`);
      } else if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: larger than 10 MB.`);
      } else {
        const body = new FormData();
        body.append("file", file);
        try {
          const response = await fetch(`/api/listings/${propertyId}/photos`, { method: "POST", body });
          const json = (await response.json().catch(() => ({}))) as { photo?: Photo; error?: string };
          if (response.ok && json.photo) added.push(json.photo);
          else problems.push(`${file.name}: ${json.error ?? "upload failed."}`);
        } catch {
          problems.push(`${file.name}: network error, please try again.`);
        }
      }
      setUploading({ done: index + 1, total: batch.length });
    }
    setPhotos((current) => [...current, ...added]);
    setErrors(problems);
    setUploading(null);
    if (added.length) {
      toast.success(`${added.length} photo${added.length === 1 ? "" : "s"} uploaded`);
      router.refresh();
    }
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const previous = photos;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    setPhotos(next);
    startTransition(async () => {
      const result = await reorderPhotosAction(propertyId, next.map((p) => p.id));
      if (!result.ok) {
        setPhotos(previous);
        toast.error(result.error);
      }
    });
  }

  function remove(photoId: string) {
    const previous = photos;
    setPhotos(photos.filter((p) => p.id !== photoId));
    startTransition(async () => {
      const result = await removePhotoAction(propertyId, photoId);
      if (!result.ok) {
        setPhotos(previous);
        toast.error(result.error);
      } else toast.success(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload([...e.dataTransfer.files]);
        }}
        className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", dragOver ? "border-emerald-600 bg-emerald-50" : "border-border bg-muted/40")}
      >
        <ImagePlus className="size-8 text-navy-500" aria-hidden="true" />
        <p className="mt-3 font-semibold text-navy-900">Drag photos here or choose files</p>
        <p className="mt-1 text-sm text-muted-foreground">
          JPG, PNG, WebP or AVIF, up to 10 MB each, at least 400 × 300 px. {photos.length}/{MAX_PHOTOS} added — at least {MIN_PHOTOS_TO_SUBMIT} needed to submit.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Location data (EXIF/GPS) is removed from uploaded photos.</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          id="photo-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void upload(files);
          }}
        />
        <Button type="button" variant="emerald" className="mt-4" disabled={Boolean(uploading) || photos.length >= MAX_PHOTOS} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
          {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : "Choose photos"}
        </Button>
      </div>

      {errors.length ? (
        <ul role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {photos.length ? (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Listing photos in display order">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border bg-white">
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={photo.url} alt={photo.altText ?? `Photo ${index + 1}`} fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />
                {index === 0 ? (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-navy-900/90 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <Star className="size-3" aria-hidden="true" /> Cover photo
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, index - 1)} disabled={index === 0 || pending} aria-label={`Move photo ${index + 1} earlier`}>
                    <ArrowLeft />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, index + 1)} disabled={index === photos.length - 1 || pending} aria-label={`Move photo ${index + 1} later`}>
                    <ArrowRight />
                  </Button>
                  {index !== 0 ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => move(index, 0)} disabled={pending}>
                      Make cover
                    </Button>
                  ) : null}
                </div>
                <Button type="button" size="icon-sm" variant="ghost" className="text-red-700" onClick={() => remove(photo.id)} disabled={pending} aria-label={`Remove photo ${index + 1}`}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex justify-end border-t pt-4">
        <Button asChild variant="emerald">
          <Link href={nextHref}>Continue to preview</Link>
        </Button>
      </div>
    </div>
  );
}
