import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { forbidden, unauthenticated } from "@/lib/errors";
import {
  createSessionRecord,
  deleteSessionByToken,
  validateSessionToken,
  type SessionUser,
} from "@/server/services/sessions";

const isSecure = (process.env.APP_URL ?? "").startsWith("https://");
// The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and path=/.
export const SESSION_COOKIE = isSecure ? "__Host-dr_session" : "dr_session";

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function startSession(userId: string) {
  const h = await headers();
  const { token, expiresAt } = await createSessionRecord(userId, {
    userAgent: h.get("user-agent"),
    ipAddress: await getClientIp(),
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByToken(token);
  jar.delete(SESSION_COOKIE);
}

/**
 * Memoised per token rather than per render: a login action sets the session cookie and
 * then renders the redirect target in the same request, so a render-wide memo would keep
 * serving the signed-out result and the header would look logged out until a reload.
 */
const loadSession = cache(async (token: string) => validateSessionToken(token));

/** Current session for this request. */
export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSession(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** For pages: redirects to login (or the dashboard) instead of throwing. */
export async function requirePageUser(roles?: Role[], returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** For server actions and route handlers: throws an AppError that becomes a friendly message. */
export async function requireActionUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}
