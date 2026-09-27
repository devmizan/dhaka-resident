import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Camera, ClipboardCheck, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { Notice } from "@/components/common/misc";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "List your property for rent",
  description: "Publish apartments, houses, rooms, hostel beds, sublets and commercial spaces on Dhaka Resident and manage enquiries and viewings in one place.",
};

const STEPS = [
  { icon: ClipboardCheck, title: "Choose the property type", text: "Apartment, house, single or shared room, hostel, sublet or commercial space." },
  { icon: Camera, title: "Add details and photos", text: "Location, rent and fees, amenities, house rules and at least three photos. Save drafts any time." },
  { icon: ShieldCheck, title: "Submit for review", text: "Our team checks every listing before it goes live, usually within a working day." },
  { icon: MessageSquare, title: "Reply to enquiries", text: "Tenants message you privately. Your phone number stays hidden unless you share it." },
  { icon: CalendarClock, title: "Offer viewing times", text: "Tenants request a time; you accept or decline. Clashing appointments are blocked automatically." },
  { icon: Users, title: "Keep it up to date", text: "Pause, update free beds, or mark it rented when you've found a tenant." },
];

export default async function ListYourPropertyPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">For owners and property managers</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">List your property on Dhaka Resident</h1>
        <p className="mt-3 text-lg text-navy-700">Reach tenants looking for homes, rooms, hostel beds and commercial space across Bangladesh. Listing is free.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {!user ? (
            <>
              <Button asChild size="lg" variant="emerald">
                <Link href="/register?role=owner&next=/dashboard/listings/new">Create an owner account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login?next=/dashboard/listings/new">I already have an account</Link>
              </Button>
            </>
          ) : user.role === "OWNER" ? (
            <Button asChild size="lg" variant="emerald">
              <Link href="/dashboard/listings/new">Start a new listing</Link>
            </Button>
          ) : null}
        </div>
        {user && user.role !== "OWNER" ? (
          <Notice className="mt-6" title={`You're signed in as ${user.role === "ADMIN" ? "an administrator" : "a tenant"}`}>
            Publishing listings needs an owner account. Log out and create an owner account with a different email address.
          </Notice>
        ) : null}
      </div>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl border bg-white p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <step.icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-bold">
              {index + 1}. {step.title}
            </h2>
            <p className="mt-1 text-sm text-navy-700">{step.text}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-2xl bg-navy-50 p-6">
        <h2 className="text-xl font-bold">Listing guidelines</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-navy-800">
          <li>Only list properties you own or are authorised to manage.</li>
          <li>Use real, recent photos of the actual property.</li>
          <li>Show the full rent, deposit, advance and service charges — no hidden fees.</li>
          <li>Don&apos;t discriminate by religion, ethnicity, caste or disability.</li>
          <li>Keep availability current; mark the property as rented when it&apos;s taken.</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Read more in our{" "}
          <Link href="/terms" className="underline">
            terms of use
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
