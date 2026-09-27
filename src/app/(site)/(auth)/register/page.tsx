import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/auth-forms";
import { AuthMethodTabs } from "@/components/forms/auth-method-tabs";
import { OtpSignupForm } from "@/components/forms/otp-forms";
import { AuthCard } from "@/components/layout/auth-card";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/utils";
import { getOtpAvailability } from "@/server/services/otp";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  const role = params.role === "owner" ? "OWNER" : "TENANT";
  const next = typeof params.next === "string" ? safeRedirectPath(params.next, "") || undefined : undefined;

  return (
    <AuthCard
      wide
      title="Create your account"
      description="Free for tenants and property owners. Sign up with a password, or with a one-time code sent to your email or mobile."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-emerald-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <AuthMethodTabs
        defaultMethod={params.method === "code" ? "code" : "password"}
        codeLabel="Email or SMS code"
        password={<RegisterForm defaultRole={role} next={next} />}
        code={<OtpSignupForm defaultRole={role} next={next} availability={getOtpAvailability()} />}
      />
    </AuthCard>
  );
}
