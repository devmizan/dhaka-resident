"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, getClientIp, getSession, requireActionUser, startSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/utils";
import { handleAction } from "@/server/action-utils";
import {
  authenticate,
  changePassword,
  registerUser,
  requestPasswordReset,
  resetPassword,
  setInitialPassword,
} from "@/server/services/auth";
import { startOtpLogin, startOtpSignup, startPhoneVerification, verifyOtp, verifyPhoneForUser } from "@/server/services/otp";
import { updateNotificationPreferences, updatePhone, updateProfile } from "@/server/services/tenant";

function homeFor(role: string) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

function allowedNext(next: string | undefined, role: string) {
  const path = safeRedirectPath(next, homeFor(role));
  if (path.startsWith("/admin") && role !== "ADMIN") return homeFor(role);
  return path;
}

/**
 * Actions that create a session hand the destination back to the browser instead of
 * calling redirect(): a server redirect is applied as a client-side navigation that
 * reuses the cached layout, so the header would keep showing the signed-out state
 * until the next full page load. The forms navigate with window.location.
 */
export async function registerAction(input: unknown) {
  return handleAction(async () => {
    const user = await registerUser(input, { ip: await getClientIp() });
    await startSession(user.id);
    revalidatePath("/", "layout");
    const next = (input as { next?: string })?.next;
    return {
      redirectTo:
        user.role === "OWNER"
          ? safeRedirectPath(next, "/dashboard/listings/new?welcome=1")
          : safeRedirectPath(next, "/dashboard?welcome=1"),
    };
  });
}

// ─── One-time codes ──────────────────────────────────────────

export async function startOtpSignupAction(input: unknown) {
  return handleAction(async () => startOtpSignup(input, { ip: await getClientIp() }));
}

export async function startOtpLoginAction(input: unknown) {
  return handleAction(async () => startOtpLogin(input, { ip: await getClientIp() }));
}

/** Verifies a sign-up or login code, starts the session and returns where to go next. */
export async function verifyOtpAction(input: unknown) {
  return handleAction(async () => {
    const user = await verifyOtp(input, { ip: await getClientIp() });
    await startSession(user.id);
    revalidatePath("/", "layout");
    const { purpose, role, next } = user;
    if (purpose === "SIGNUP") {
      return {
        redirectTo:
          role === "OWNER"
            ? safeRedirectPath(next, "/dashboard/listings/new?welcome=1")
            : safeRedirectPath(next, "/dashboard?welcome=1"),
      };
    }
    return { redirectTo: allowedNext(next, role) };
  });
}

export async function startPhoneVerificationAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    return startPhoneVerification(user.id, input, { ip: await getClientIp() });
  });
}

export async function verifyPhoneAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await verifyPhoneForUser(user.id, input, { ip: await getClientIp() });
    revalidatePath("/dashboard/account");
  }, "Mobile number verified. You can now log in with a code sent by SMS.");
}

export async function updatePhoneAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await updatePhone(user, input);
    revalidatePath("/dashboard/account");
  }, "Mobile number saved.");
}

export async function setPasswordAction(input: unknown) {
  return handleAction(async () => {
    const session = await getSession();
    const user = await requireActionUser();
    await setInitialPassword(user.id, session!.sessionId, input);
    revalidatePath("/dashboard/account");
  }, "Password set. You can now log in with your password or a code.");
}

export async function loginAction(input: unknown) {
  return handleAction(async () => {
    const user = await authenticate(input, { ip: await getClientIp() });
    await startSession(user.id);
    revalidatePath("/", "layout");
    return { redirectTo: allowedNext(user.next, user.role) };
  });
}

export async function logoutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(input: unknown) {
  return handleAction(async () => requestPasswordReset(input, { ip: await getClientIp() }));
}

export async function resetPasswordAction(input: unknown) {
  const result = await handleAction(() => resetPassword(input));
  if (!result.ok) return result;
  redirect("/login?reset=1");
}

export async function changePasswordAction(input: unknown) {
  return handleAction(async () => {
    const session = await getSession();
    const user = await requireActionUser();
    await changePassword(user.id, session!.sessionId, input);
  }, "Password updated. Other devices have been signed out.");
}

export async function updateProfileAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await updateProfile(user, input);
    revalidatePath("/", "layout");
  }, "Profile saved.");
}

export async function updateNotificationPreferencesAction(input: unknown) {
  return handleAction(async () => {
    const user = await requireActionUser();
    await updateNotificationPreferences(user, input);
    revalidatePath("/dashboard/account");
  }, "Notification settings saved.");
}
