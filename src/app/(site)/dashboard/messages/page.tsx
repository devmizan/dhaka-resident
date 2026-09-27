import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/misc";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getConversationList } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Enquiries & messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const user = await requirePageUser(["TENANT", "OWNER"], "/dashboard/messages");
  const params = await searchParams;
  const status = params.status === "CLOSED" ? "CLOSED" : params.status === "OPEN" ? "OPEN" : undefined;
  const conversations = await getConversationList(user, { status });
  const isOwner = user.role === "OWNER";

  const tabs = [
    { label: "All", href: "/dashboard/messages", active: !status },
    { label: "Open", href: "/dashboard/messages?status=OPEN", active: status === "OPEN" },
    { label: "Closed", href: "/dashboard/messages?status=CLOSED", active: status === "CLOSED" },
  ];

  return (
    <>
      <PageHeader
        title="Enquiries & messages"
        description={isOwner ? "Enquiries from tenants about your listings." : "Your conversations with owners and property managers."}
      />
      <nav aria-label="Filter conversations" className="mt-5 flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn("inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold", tab.active ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-border hover:bg-navy-50")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {conversations.length ? (
        <ul className="mt-5 divide-y overflow-hidden rounded-2xl border bg-white">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/messages/${c.id}`} className={cn("flex gap-4 p-4 transition-colors hover:bg-navy-50/60", c.unread && "bg-emerald-50/50")}>
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {c.property.photos[0] ? <Image src={c.property.photos[0].url} alt="" fill sizes="64px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("truncate text-navy-900", c.unread ? "font-bold" : "font-semibold")}>{c.counterpart}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-sm text-navy-700">{c.property.title}</p>
                  <p className={cn("mt-0.5 line-clamp-1 text-sm", c.unread ? "font-medium text-navy-900" : "text-muted-foreground")}>{c.preview}</p>
                  <div className="mt-1 flex gap-2">
                    {c.unread ? <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">New</span> : null}
                    {c.status === "CLOSED" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Closed</span> : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-6"
          icon={MessageSquare}
          title={status ? "No conversations in this view" : "No conversations yet"}
          description={isOwner ? "When tenants send enquiries about your listings, they'll appear here." : "Send an enquiry from any listing to start a conversation with the owner."}
          action={
            isOwner ? null : (
              <Button asChild variant="emerald">
                <Link href="/search">Browse rentals</Link>
              </Button>
            )
          }
        />
      )}
    </>
  );
}
