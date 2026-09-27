"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { acceptViewingAction, cancelViewingAction, declineViewingAction } from "@/server/actions/interactions";

type Kind = "accept" | "decline" | "cancel";

const COPY: Record<Kind, { button: string; title: string; description: string; confirm: string }> = {
  accept: {
    button: "Accept",
    title: "Accept this viewing?",
    description: "The tenant will be notified. Accepting a viewing is not a rental agreement. If you already have a confirmed viewing at this time, you'll be asked to resolve the clash first.",
    confirm: "Accept viewing",
  },
  decline: { button: "Decline", title: "Decline this viewing request?", description: "Optionally tell the tenant why, or suggest another time.", confirm: "Decline request" },
  cancel: { button: "Cancel viewing", title: "Cancel this viewing?", description: "The other person will be notified.", confirm: "Cancel viewing" },
};

const ACTIONS = { accept: acceptViewingAction, decline: declineViewingAction, cancel: cancelViewingAction };

function ViewingActionDialog({ viewingId, kind }: { viewingId: string; kind: Kind }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = COPY[kind];

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await ACTIONS[kind]({ viewingId, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setNote("");
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={kind === "accept" ? "emerald" : kind === "decline" ? "outline" : "ghost"} size="sm" className={kind === "cancel" ? "text-red-700 hover:text-red-800" : undefined}>
          {kind === "accept" ? <Check data-icon="inline-start" /> : kind === "decline" ? <X data-icon="inline-start" /> : null}
          {copy.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {kind === "accept" ? "Note for the tenant (optional)" : "Note (optional)"}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder={kind === "accept" ? "e.g. Ask the guard for Flat 6B" : ""} />
        </label>
        <DialogFooter>
          <Button variant={kind === "accept" ? "emerald" : "destructive"} onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ViewingActions({ viewingId, actions }: { viewingId: string; actions: Kind[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((kind) => (
        <ViewingActionDialog key={kind} viewingId={viewingId} kind={kind} />
      ))}
    </div>
  );
}
