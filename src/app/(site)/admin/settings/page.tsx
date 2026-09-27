import type { Metadata } from "next";
import { SiteSettingsForm } from "@/components/admin/catalogue-forms";
import { Notice, PageHeader } from "@/components/common/misc";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isEmailConfigured } from "@/server/services/email";
import { isSmsConfigured, smsProviderName } from "@/server/services/sms";
import { getSiteSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Website settings" };

export default async function SettingsPage() {
  await requirePageUser(["ADMIN"], "/admin/settings");
  const [settings, emails] = await Promise.all([getSiteSettings(), db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 })]);
  const configured = isEmailConfigured();

  return (
    <>
      <PageHeader title="Website settings" description="Contact details and announcements shown across the site." />
      <section className="mt-6 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="general-heading">
        <h2 id="general-heading" className="mb-4 text-lg font-bold">
          General
        </h2>
        <SiteSettingsForm defaults={settings} />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="email-heading">
        <h2 id="email-heading" className="text-lg font-bold">
          Email and SMS delivery
        </h2>
        {configured ? (
          <Notice className="mt-3" title="SMTP is configured">
            Emails are sent through {process.env.SMTP_HOST}:{process.env.SMTP_PORT || "587"} from {process.env.EMAIL_FROM || "the default sender"}.
          </Notice>
        ) : (
          <Notice tone="warning" className="mt-3" title="Emails are not being sent">
            Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> and <code>EMAIL_FROM</code> in the server&apos;s environment (for example in <code>.env</code>) and restart the app. Until then users only receive in-app notifications, and password reset links must be created from the Users page.
          </Notice>
        )}
        <h3 className="mt-6 text-sm font-semibold">SMS (one-time codes)</h3>
        {isSmsConfigured() ? (
          <Notice className="mt-2" title="SMS is configured">
            Sign-up and login codes are sent by SMS through {smsProviderName()}.
          </Notice>
        ) : (
          <Notice tone="warning" className="mt-2" title="SMS codes are not being sent">
            Set <code>SMS_PROVIDER=twilio</code> with <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_FROM_NUMBER</code>.
            {process.env.NODE_ENV === "production"
              ? " Until then, people can't sign up or log in with a mobile number and code."
              : " In development, codes are printed in the terminal running npm run dev."}
          </Notice>
        )}
        <h3 className="mt-5 text-sm font-semibold">Recent email attempts</h3>
        {emails.length ? (
          <div className="mt-2 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">When</th>
                  <th scope="col" className="px-3 py-2 font-semibold">To</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Subject</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(email.createdAt)}</td>
                    <td className="px-3 py-2">{email.to}</td>
                    <td className="px-3 py-2">{email.subject}</td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", email.status === "SENT" ? "bg-emerald-50 text-emerald-800" : email.status === "SKIPPED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800")} title={email.error ?? undefined}>
                        {email.status === "SKIPPED" ? "Not sent (no SMTP)" : email.status === "SENT" ? "Sent" : "Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No emails attempted yet.</p>
        )}
      </section>
    </>
  );
}
