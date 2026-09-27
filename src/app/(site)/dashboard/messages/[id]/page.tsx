import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { SampleBadge, ViewingStatusBadge } from "@/components/common/misc";
import { ConversationStatusButton, MessageThread } from "@/components/dashboard/message-thread";
import { requirePageUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatRent } from "@/lib/format";
import { getConversation } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await params;
  const user = await requirePageUser(["TENANT", "OWNER"], `/dashboard/messages/${id}`);
  const conversation = await getConversation(user, id);
  if (!conversation) notFound();

  const isOwner = conversation.ownerId === user.id;
  const timeZone = conversation.property.city?.country.timeZone;
  const counterpart = isOwner ? conversation.tenant.name : (conversation.owner.companyName ?? conversation.owner.name);
  const rent = formatRent(conversation.property.rentAmount, conversation.property.billingPeriod, conversation.property.currencyCode, conversation.property.category.usesRoomTypes);
  const names = new Map([
    [conversation.tenant.id, conversation.tenant.name],
    [conversation.owner.id, conversation.owner.companyName ?? conversation.owner.name],
  ]);

  return (
    <>
      <Link href="/dashboard/messages" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-navy-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All conversations
      </Link>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{counterpart}</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Tenant enquiry" : "Owner / manager"} · started {formatDate(conversation.createdAt)}
            {conversation.tenant.isDemo || conversation.owner.isDemo ? " · demo accounts" : ""}
          </p>
        </div>
        {isOwner ? <ConversationStatusButton enquiryId={conversation.id} status={conversation.status} /> : null}
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_300px]">
        <MessageThread
          enquiryId={conversation.id}
          canReply={isOwner || conversation.status === "OPEN"}
          closedNotice="The owner closed this conversation. Send a new enquiry from the listing if you're still interested."
          messages={conversation.messages.map((m) => ({
            id: m.id,
            body: m.body,
            mine: m.senderId === user.id,
            senderName: names.get(m.senderId) ?? "Participant",
            time: formatDateTime(m.createdAt, timeZone),
          }))}
        />

        <aside className="flex flex-col gap-4">
          <Link href={`/properties/${conversation.property.slug}`} className="block overflow-hidden rounded-2xl border bg-white hover:shadow-sm">
            <div className="relative aspect-[16/10] bg-muted">
              {conversation.property.photos[0] ? <Image src={conversation.property.photos[0].url} alt="" fill sizes="300px" className="object-cover" /> : null}
            </div>
            <div className="p-4">
              {conversation.property.isDemo ? <SampleBadge className="mb-2" /> : null}
              <p className="font-semibold text-navy-900">{conversation.property.title}</p>
              <p className="text-sm text-muted-foreground">{[conversation.property.neighborhood?.name, conversation.property.city?.name].filter(Boolean).join(", ")}</p>
              <p className="mt-2 font-bold text-navy-900">
                {rent.amount} <span className="text-sm font-normal text-muted-foreground">{rent.suffix}</span>
              </p>
              {conversation.property.status !== "PUBLISHED" ? <p className="mt-1 text-xs font-medium text-amber-800">This listing is no longer live.</p> : null}
            </div>
          </Link>

          {conversation.moveInDate || conversation.occupants ? (
            <dl className="rounded-2xl border bg-white p-4 text-sm">
              {conversation.moveInDate ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Move-in</dt>
                  <dd className="font-medium">{formatDate(conversation.moveInDate)}</dd>
                </div>
              ) : null}
              {conversation.occupants ? (
                <div className="mt-1 flex justify-between gap-2">
                  <dt className="text-muted-foreground">Occupants</dt>
                  <dd className="font-medium">{conversation.occupants}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="rounded-2xl border bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4" aria-hidden="true" />
              Viewing requests
            </h2>
            {conversation.viewingRequests.length ? (
              <ul className="mt-2 space-y-2">
                {conversation.viewingRequests.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{formatDateTime(v.startsAt, timeZone)}</span>
                    <ViewingStatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
            )}
            <Link href="/dashboard/viewings" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
              Manage viewings
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
