import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of use" intro="The rules for using Dhaka Resident." updated="16 September 2026">
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">This is a starter document for the project. Have it reviewed by a qualified professional before launching publicly.</p>
      <section>
        <h2>What Dhaka Resident is</h2>
        <p>
          Dhaka Resident is a listing platform that connects tenants with property owners and managers. We do not own, manage or rent out properties, and we are not a party to any rental agreement. Enquiries and viewing requests are not bookings.
        </p>
      </section>
      <section>
        <h2>Accounts</h2>
        <ul>
          <li>Provide accurate information and keep your password secure.</li>
          <li>Tenant and owner accounts are self-service. Administrator access is granted only by existing administrators.</li>
          <li>We may suspend accounts that break these terms.</li>
        </ul>
      </section>
      <section>
        <h2>Listings</h2>
        <ul>
          <li>Only list properties you own or are authorised to rent out.</li>
          <li>Listings must be accurate, include all mandatory charges, and use real photos of the property.</li>
          <li>Listings must not discriminate on grounds such as religion, ethnicity, caste or disability.</li>
          <li>All listings are reviewed and may be rejected or unpublished.</li>
        </ul>
      </section>
      <section>
        <h2>Messages and safety</h2>
        <ul>
          <li>Don&apos;t send spam, abusive messages or requests for payment before a viewing.</li>
          <li>Never pay a deposit or rent before visiting the property and signing an agreement.</li>
        </ul>
      </section>
      <section>
        <h2>Sample content</h2>
        <p>Listings and accounts marked as samples or demo accounts are for demonstration only and do not represent real properties or people.</p>
      </section>
    </ContentPage>
  );
}
