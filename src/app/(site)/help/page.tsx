import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Help centre", description: "Answers to common questions about searching, enquiring, viewings and listing properties on Dhaka Resident." };

const FAQ = [
  {
    id: "tenants",
    title: "For tenants",
    items: [
      { q: "Is an enquiry or viewing request a booking?", a: "No. Enquiries and viewing requests start a conversation with the owner. Nothing is reserved and no rental agreement is created on Dhaka Resident. Agree terms directly with the owner and sign a written agreement." },
      { q: "How do viewings work?", a: "Choose one of the times the owner offered, or suggest your own. The owner accepts or declines, and you'll get a notification. You can cancel a pending or accepted viewing from your dashboard." },
      { q: "Why can't I see the exact address?", a: "Owners choose whether to show the full address publicly, only after a viewing is accepted, or share it in messages. The map always shows the approximate area only." },
      { q: "What does “Sample listing” mean?", a: "Sample listings are demonstration content. They are not real properties." },
    ],
  },
  {
    id: "owners",
    title: "For owners and managers",
    items: [
      { q: "Why does my listing need approval?", a: "Every listing is reviewed to keep scams and misleading listings off the site. If changes are needed, you'll see the reason in your dashboard." },
      { q: "Will editing a live listing unpublish it?", a: "Changing content (description, photos, rent, rules) sends the listing back for review. Updating the available date or free beds from the listing's management page does not." },
      { q: "How do I manage hostel beds?", a: "Choose Hostel or Shared room as the type, add room types with total beds, available beds and price per bed, then update free beds any time from the management page." },
      { q: "Can two tenants be confirmed for the same time?", a: "No. The system blocks accepting a viewing that overlaps another confirmed viewing, and viewing times you offer can't overlap across your listings." },
    ],
  },
  {
    id: "safety",
    title: "Renting safely",
    items: [
      { q: "Should I pay a deposit to hold a property?", a: "Never send money before you have visited the property, confirmed the owner's identity and signed an agreement. Dhaka Resident never asks you to pay through messages." },
      { q: "How do I report a suspicious listing?", a: "Use “Report listing” on the property page. Reports are reviewed by our moderation team." },
    ],
  },
];

export default function HelpPage() {
  return (
    <ContentPage title="Help centre" intro="Quick answers about finding and listing rentals.">
      {FAQ.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24">
          <h2>{section.title}</h2>
          <div className="divide-y rounded-2xl border bg-white">
            {section.items.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="cursor-pointer list-none font-semibold text-navy-900 marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-emerald-700 transition-transform group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-navy-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p>
        Still need help?{" "}
        <Link href="/contact" className="font-semibold text-emerald-700 underline">
          Contact us
        </Link>
        .
      </p>
    </ContentPage>
  );
}
