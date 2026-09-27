import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Notice, PageHeader } from "@/components/common/misc";
import { ChangePasswordForm, NotificationPreferencesForm, PhoneForm, ProfileForm } from "@/components/forms/account-forms";
import { PhoneVerificationForm, SetPasswordForm } from "@/components/forms/otp-forms";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { isEmailConfigured } from "@/server/services/email";
import { getOtpAvailability } from "@/server/services/otp";

export const metadata: Metadata = { title: "Account settings" };

function Verified({ at }: { at: Date | null }) {
  if (!at) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Not verified</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      Verified
    </span>
  );
}

export default async function AccountPage() {
  const session = await requirePageUser(undefined, "/dashboard/account");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  const otp = getOtpAvailability();
  const hasPassword = user.passwordHash !== null;

  return (
    <>
      <PageHeader title="Account settings" description={`${ROLE_LABELS[user.role]} · member since ${formatDate(user.createdAt)}`} />
      {user.isDemo ? (
        <Notice className="mt-5" title="Demo account">
          This is a sample account for local development. Its password is regenerated each time the database is seeded.
        </Notice>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        <section className="rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-lg font-bold">
            Sign-in details
          </h2>
          <dl className="mt-3 mb-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-navy-900">
                {user.email ?? "Not added"}
                {user.email ? <Verified at={user.emailVerifiedAt} /> : null}
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-muted-foreground">Mobile number</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-navy-900">
                {user.phone ? formatPhone(user.phone) : "Not added"}
                {user.phone ? <Verified at={user.phoneVerifiedAt} /> : null}
              </dd>
            </div>
          </dl>
          <p className="mb-4 text-sm text-muted-foreground">
            {user.email ? "You can log in with a code sent to your email. " : ""}
            {user.phoneVerifiedAt ? "You can log in with a code sent to your mobile by SMS. " : ""}
            Email addresses can&apos;t be changed here — contact support if you need to update yours.
          </p>
          {otp.sms ? (
            <PhoneVerificationForm phone={user.phone} verified={Boolean(user.phoneVerifiedAt)} smsAvailable />
          ) : (
            <PhoneForm phone={user.phone ? formatPhone(user.phone) : ""} />
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="mb-5 text-lg font-bold">
            Profile
          </h2>
          <ProfileForm isOwner={user.role === "OWNER"} defaults={{ name: user.name, companyName: user.companyName ?? "", bio: user.bio ?? "" }} />
        </section>

        <section className="rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className="text-lg font-bold">
            Notification settings
          </h2>
          {!user.email ? (
            <Notice className="my-4" title="In-app notifications only">
              Your account doesn&apos;t have an email address, so notifications appear here in the app and in the bell menu.
            </Notice>
          ) : !isEmailConfigured() ? (
            <Notice tone="warning" className="my-4" title="Emails are not being sent">
              Email delivery isn&apos;t configured on this server. Your preferences are saved and will apply once an administrator configures SMTP. Until then you&apos;ll see notifications in the app only.
            </Notice>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">Choose which updates we email to {user.email}.</p>
          )}
          <NotificationPreferencesForm
            defaults={{ emailNotifications: user.emailNotifications, notifyEnquiries: user.notifyEnquiries, notifyViewings: user.notifyViewings, notifyListing: user.notifyListing }}
          />
        </section>

        <section className="rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="password-heading">
          <h2 id="password-heading" className="text-lg font-bold">
            Password
          </h2>
          {hasPassword ? (
            <>
              <p className="mb-5 text-sm text-muted-foreground">Changing your password signs you out on other devices.</p>
              <ChangePasswordForm />
            </>
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">You signed up with a one-time code. Add a password if you&apos;d also like to log in with one.</p>
              <SetPasswordForm />
            </>
          )}
        </section>
      </div>
    </>
  );
}
