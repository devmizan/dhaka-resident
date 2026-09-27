"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2, Pause, Play, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { ListingStatus } from "@/generated/prisma/enums";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { availableOwnerActions } from "@/lib/listing-status";
import { changeListingStatusAction, deleteListingAction, submitListingAction } from "@/server/actions/listings";

const LABELS = {
  submit: { label: "Submit for approval", icon: Send, variant: "emerald" as const },
  withdraw: { label: "Withdraw to draft", icon: Undo2, variant: "outline" as const },
  pause: { label: "Pause listing", icon: Pause, variant: "outline" as const },
  resume: { label: "Resume listing", icon: Play, variant: "emerald" as const },
  markRented: { label: "Mark as rented", icon: CheckCircle2, variant: "outline" as const },
  relist: { label: "Relist", icon: RotateCcw, variant: "emerald" as const },
};

export function ListingStatusControls({ propertyId, status, canDelete, compact = false }: { propertyId: string; status: ListingStatus; canDelete: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const actions = availableOwnerActions(status);

  const run = (action: keyof typeof LABELS) =>
    startTransition(async () => {
      const result = action === "submit" ? await submitListingAction(propertyId) : await changeListingStatusAction(propertyId, action);
      if (result && !result.ok) toast.error(result.error);
      else if (result?.ok) toast.success(result.message);
    });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const config = LABELS[action as keyof typeof LABELS];
        if (!config) return null;
        const Icon = config.icon;
        if (action === "markRented") {
          return (
            <AlertDialog key={action}>
              <AlertDialogTrigger asChild>
                <Button variant={config.variant} size={compact ? "sm" : "default"} disabled={pending}>
                  <Icon data-icon="inline-start" />
                  {config.label}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark this property as rented?</AlertDialogTitle>
                  <AlertDialogDescription>It will be hidden from search. Existing conversations stay available, and you can relist it later.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it live</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run("markRented")}>Mark as rented</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        }
        return (
          <Button key={action} variant={config.variant} size={compact ? "sm" : "default"} disabled={pending} onClick={() => run(action as keyof typeof LABELS)}>
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Icon data-icon="inline-start" />}
            {config.label}
          </Button>
        );
      })}
      {canDelete ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size={compact ? "sm" : "default"} className="text-red-700 hover:text-red-800" disabled={pending}>
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
              <AlertDialogDescription>This permanently removes the listing and its photos. This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-700 text-white hover:bg-red-800"
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteListingAction(propertyId);
                    if (result && !result.ok) toast.error(result.error);
                  })
                }
              >
                Delete listing
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
