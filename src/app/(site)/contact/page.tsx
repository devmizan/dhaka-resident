import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { ContentPage } from "@/components/layout/content-page";
import { getSiteSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with the Dhaka Resident support team." };

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <ContentPage title="Contact us" intro="We're happy to help with account, listing and safety questions.">
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-2xl border bg-white p-5">
          <Mail className="size-5 text-emerald-700" aria-hidden="true" />
          <p className="mt-2 font-semibold">Email</p>
          <a href={`mailto:${settings.contactEmail}`} className="text-emerald-700 underline">
            {settings.contactEmail}
          </a>
        </li>
        {settings.contactPhone ? (
          <li className="rounded-2xl border bg-white p-5">
            <Phone className="size-5 text-emerald-700" aria-hidden="true" />
            <p className="mt-2 font-semibold">Phone</p>
            <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`} className="text-emerald-700 underline">
              {settings.contactPhone}
            </a>
          </li>
        ) : null}
        {settings.officeAddress ? (
          <li className="rounded-2xl border bg-white p-5">
            <MapPin className="size-5 text-emerald-700" aria-hidden="true" />
            <p className="mt-2 font-semibold">Office</p>
            <p>{settings.officeAddress}</p>
          </li>
        ) : null}
      </ul>
      <section>
        <h2>Reporting a listing</h2>
        <p>
          To report a suspicious or inaccurate listing, open it and use <strong>Report listing</strong> so our moderators get all the details. See also{" "}
          <Link href="/help#safety" className="text-emerald-700 underline">
            renting safely
          </Link>
          .
        </p>
      </section>
    </ContentPage>
  );
}
