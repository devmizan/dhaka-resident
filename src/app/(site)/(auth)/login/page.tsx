import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/common/misc";
import { LoginForm } from "@/components/forms/auth-forms";
import { AuthMethodTabs } from "@/components/forms/auth-method-tabs";
import { OtpLoginForm } from "@/components/forms/otp-forms";
import { AuthCard } from "@/components/layout/auth-card";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/utils";
import { getOtpAvailability } from "@/server/services/otp";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next, "") || undefined : undefined;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" && !next ? "/admin" : (next ?? "/dashboard"));

  return (
    <AuthCard
      title="Log in"
      description="Welcome back to Dhaka Resident. Tenants, owners and administrators all sign in here."
      footer={
        <>
          New here?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-emerald-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {params.reset === "1" ? (
        <Notice className="mb-4" title="Password updated">
          Log in with your new password. You were signed out on all devices.
        </Notice>
      ) : null}
      <AuthMethodTabs
        defaultMethod={params.method === "code" ? "code" : "password"}
        codeLabel="Email or SMS code"
        password={<LoginForm next={next} />}
        code={<OtpLoginForm next={next} availability={getOtpAvailability()} />}
      />
    </AuthCard>
  );
}
