import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" intro="How Dhaka Resident collects and uses personal information." updated="16 September 2026">
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">This is a starter policy for the project. Have it reviewed by a qualified professional before launching publicly.</p>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: name, email, optional phone number, and a securely hashed password (we never store your password itself).</li>
          <li>Listing content that owners publish, including photos. Location metadata (EXIF/GPS) is removed from uploaded photos.</li>
          <li>Enquiries, messages, viewing requests, saved properties and reports you create.</li>
          <li>Security data: session records, IP address and browser details used to keep accounts safe and limit abuse.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run the marketplace: show listings, deliver messages and notifications, and manage viewings.</li>
          <li>To moderate listings and investigate reports.</li>
          <li>To protect accounts, for example by rate-limiting sign-in attempts.</li>
        </ul>
      </section>
      <section>
        <h2>Who can see your information</h2>
        <ul>
          <li>Messages are visible only to the tenant and owner in the conversation.</li>
          <li>Your phone number and email are not shown on listings.</li>
          <li>Owners control whether the full property address is public, shown after an accepted viewing, or kept private.</li>
          <li>Administrators can access information when needed to moderate and support the service.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>We use one essential, HTTP-only session cookie to keep you signed in. We don&apos;t use advertising cookies.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can update your profile and email notification settings from your account page. Contact us to request a copy or deletion of your data.</p>
      </section>
    </ContentPage>
  );
}
