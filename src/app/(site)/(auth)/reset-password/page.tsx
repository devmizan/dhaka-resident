import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { AuthCard } from "@/components/layout/auth-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hashToken } from "@/server/services/sessions";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const record = token.length >= 20 && token.length <= 128 ? await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } }) : null;
  const valid = Boolean(record && !record.usedAt && record.expiresAt > new Date());

  if (!valid) {
    return (
      <AuthCard title="This link has expired" description="Password reset links work once and expire after 1 hour.">
        <Button asChild variant="emerald" className="w-full" size="lg">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="You'll be signed out of all devices after changing it.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
