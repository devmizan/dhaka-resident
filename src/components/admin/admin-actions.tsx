"use client";

import { useState, useTransition } from "react";
import { Ban, Check, Copy, KeyRound, Loader2, Star, StarOff, X } from "lucide-react";
import { toast } from "sonner";
import type { ListingStatus, Role } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";
import {
  approveListingAction,
  changeUserRoleAction,
  createResetLinkAction,
  rejectListingAction,
  resolveReportAction,
  setFeaturedAction,
  setUserSuspendedAction,
  unpublishListingAction,
} from "@/server/actions/admin";

function report(result: ActionResult<unknown>) {
  if (result.ok) toast.success(result.message ?? "Done");
  else toast.error(result.error);
  return result.ok;
}

function ReasonDialog({ trigger, title, description, confirm, onConfirm, destructive = true }: { trigger: React.ReactNode; title: string; description: string; confirm: string; onConfirm: (reason: string) => Promise<ActionResult<unknown>>; destructive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Reason (shown to the owner)
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500} aria-invalid={Boolean(error)} />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant={destructive ? "destructive" : "emerald"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await onConfirm(reason);
                if (!result.ok) {
                  setError(result.fieldErrors?.reason?.[0] ?? result.error);
                  return;
                }
                toast.success(result.message ?? "Done");
                setOpen(false);
                setReason("");
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ListingModerationActions({ propertyId, status, isFeatured }: { propertyId: string; status: ListingStatus; isFeatured: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING_REVIEW" ? (
        <>
          <Button size="sm" variant="emerald" disabled={pending} onClick={() => startTransition(async () => void report(await approveListingAction(propertyId)))}>
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            Approve
          </Button>
          <ReasonDialog
            trigger={
              <Button size="sm" variant="outline">
                <X data-icon="inline-start" />
                Reject
              </Button>
            }
            title="Reject this listing"
            description="The owner will see your reason and can edit and resubmit."
            confirm="Reject listing"
            onConfirm={(reason) => rejectListingAction({ propertyId, reason })}
          />
        </>
      ) : null}
      {status === "PUBLISHED" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => void report(await setFeaturedAction(propertyId, !isFeatured)))}>
          {isFeatured ? <StarOff data-icon="inline-start" /> : <Star data-icon="inline-start" />}
          {isFeatured ? "Unfeature" : "Feature"}
        </Button>
      ) : null}
      {status === "PUBLISHED" || status === "PAUSED" || status === "RENTED" ? (
        <ReasonDialog
          trigger={
            <Button size="sm" variant="ghost" className="text-red-700">
              <Ban data-icon="inline-start" />
              Unpublish
            </Button>
          }
          title="Unpublish this listing"
          description="It will be hidden from tenants immediately. The owner must make changes and resubmit."
          confirm="Unpublish"
          onConfirm={(reason) => unpublishListingAction({ propertyId, reason })}
        />
      ) : null}
    </div>
  );
}

export function UserAdminActions({ userId, role, suspended, isSelf }: { userId: string; role: Role; suspended: boolean; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  if (isSelf) return <span className="text-xs text-muted-foreground">This is you</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select
        id={`role-${userId}`}
        className="h-9 rounded-lg border border-input bg-white px-2 text-sm"
        value={role}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Role;
          if (next === "ADMIN" && !window.confirm("Give this user full administrator access?")) return;
          startTransition(async () => void report(await changeUserRoleAction({ userId, role: next })));
        }}
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant={suspended ? "outline" : "ghost"}
        className={suspended ? undefined : "text-red-700"}
        disabled={pending}
        onClick={() => {
          if (!suspended && !window.confirm("Suspend this account? They will be signed out and their live listings paused.")) return;
          startTransition(async () => void report(await setUserSuspendedAction(userId, !suspended)));
        }}
      >
        {suspended ? "Reactivate" : "Suspend"}
      </Button>
      {!suspended ? (
        <Dialog onOpenChange={(open) => !open && setLink(null)}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <KeyRound data-icon="inline-start" />
              Reset link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a password reset link</DialogTitle>
              <DialogDescription>Use this when email isn&apos;t configured. Share the link with the user through a trusted channel. It works once and expires in 1 hour.</DialogDescription>
            </DialogHeader>
            {link ? (
              <div className="flex flex-col gap-2">
                <code className="block rounded-lg bg-muted p-3 text-xs break-all">{link}</code>
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link);
                    toast.success("Copied");
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Copy link
                </Button>
              </div>
            ) : (
              <DialogFooter>
                <Button
                  variant="emerald"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await createResetLinkAction(userId);
                      if (result.ok) setLink(result.data);
                      else toast.error(result.error);
                    })
                  }
                >
                  {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  Create link
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export function ResolveReportDialog({ reportId, listingLive }: { reportId: string; listingLive: boolean }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [note, setNote] = useState("");
  const [unpublish, setUnpublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="emerald">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review report</DialogTitle>
          <DialogDescription>Record what you found. The reporter is notified that the report was reviewed.</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Outcome</legend>
          {(["RESOLVED", "DISMISSED"] as const).map((value) => (
            <label key={value} className="flex min-h-10 items-center gap-3 rounded-lg border px-3 text-sm has-checked:border-emerald-600 has-checked:bg-emerald-50">
              <input type="radio" name={`status-${reportId}`} className="size-5 accent-emerald-700" checked={status === value} onChange={() => setStatus(value)} />
              {value === "RESOLVED" ? "Resolved — action taken or issue confirmed" : "Dismissed — no problem found"}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Resolution note
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
        </label>
        {listingLive ? (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-red-700" checked={unpublish} onChange={(e) => setUnpublish(e.target.checked)} />
            Also unpublish the listing (the note is shown to the owner)
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="emerald"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await resolveReportAction({ reportId, status, resolutionNote: note, unpublishListing: unpublish });
                if (!result.ok) {
                  setError(result.fieldErrors?.resolutionNote?.[0] ?? result.error);
                  return;
                }
                toast.success(result.message);
                setOpen(false);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Save outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
