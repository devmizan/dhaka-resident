"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyActionErrors, FormAlert, useIdempotencyKey } from "@/components/forms/form-helpers";
import { messageSchema } from "@/lib/validation/interactions";
import { cn } from "@/lib/utils";
import { markEnquiryReadAction, sendMessageAction, setEnquiryStatusAction } from "@/server/actions/interactions";

type Message = { id: string; body: string; mine: boolean; senderName: string; time: string };

export function MessageThread({ enquiryId, messages, canReply, closedNotice }: { enquiryId: string; messages: Message[]; canReply: boolean; closedNotice?: string }) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [key, rotateKey] = useIdempotencyKey();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(messageSchema), defaultValues: { enquiryId, body: "", idempotencyKey: key } });
  const { register, handleSubmit, formState, reset } = form;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    void markEnquiryReadAction(enquiryId);
  }, [enquiryId, messages.length]);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await sendMessageAction({ ...values, idempotencyKey: key });
    if (!result.ok) {
      setFormError(applyActionErrors(form, result));
      return;
    }
    rotateKey();
    reset({ enquiryId, body: "", idempotencyKey: key });
    router.refresh();
  });

  return (
    <div className="flex flex-col rounded-2xl border bg-white">
      <ol className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto p-4 sm:p-5" aria-label="Messages" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex max-w-[85%] flex-col", m.mine ? "items-end self-end" : "items-start self-start")}>
            <div className={cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line", m.mine ? "rounded-br-sm bg-navy-900 text-white" : "rounded-bl-sm bg-navy-50 text-navy-900")}>{m.body}</div>
            <span className="mt-1 px-1 text-xs text-muted-foreground">
              {m.mine ? "You" : m.senderName} · {m.time}
            </span>
          </li>
        ))}
        <div ref={bottomRef} />
      </ol>
      <div className="border-t p-3 sm:p-4">
        {canReply ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
            <FormAlert message={formError} />
            <label htmlFor="reply" className="sr-only">
              Write a message
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="reply"
                rows={2}
                placeholder="Write a message…"
                className="min-h-12 flex-1 resize-y rounded-xl border border-input px-3 py-2.5 text-base focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none md:text-sm"
                aria-invalid={Boolean(formState.errors.body)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void onSubmit();
                }}
                {...register("body")}
              />
              <Button type="submit" variant="emerald" size="icon-lg" className="size-12" disabled={formState.isSubmitting} aria-label="Send message">
                {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
            {formState.errors.body ? <p className="text-sm text-red-700">{formState.errors.body.message}</p> : <p className="text-xs text-muted-foreground">Ctrl + Enter to send. Never share bank or card details in messages.</p>}
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{closedNotice}</p>
        )}
      </div>
    </div>
  );
}

export function ConversationStatusButton({ enquiryId, status }: { enquiryId: string; status: "OPEN" | "CLOSED" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setEnquiryStatusAction(enquiryId, status === "OPEN" ? "CLOSED" : "OPEN");
          if (result.ok) toast.success(result.message);
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
      {status === "OPEN" ? "Close conversation" : "Reopen conversation"}
    </Button>
  );
}
