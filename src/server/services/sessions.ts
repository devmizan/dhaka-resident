import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const SESSION_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phone: true,
  isDemo: true,
} as const;

export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  role: "TENANT" | "OWNER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  phone: string | null;
  isDemo: boolean;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSessionRecord(userId: string, meta: { userAgent?: string | null; ipAddress?: string | null } = {}) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    },
  });
  return { token, expiresAt };
}

/** Resolves a raw cookie token into an active session user, or null. */
export async function validateSessionToken(token: string): Promise<{ sessionId: string; user: SessionUser } | null> {
  if (!token || token.length > 128) return null;
  const sessionId = hashToken(token);
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: SESSION_USER_SELECT } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return { sessionId, user: session.user };
}

export async function deleteSessionByToken(token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function deleteUserSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
