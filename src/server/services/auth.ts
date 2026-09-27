import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, invalid, isUniqueConstraintError } from "@/lib/errors";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "@/lib/validation/auth";
import { appUrl, isEmailConfigured, sendEmail } from "@/server/services/email";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";
import { deleteUserSessions, generateToken, hashToken } from "@/server/services/sessions";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw invalid("Please check the highlighted fields.", z.flattenError(result.error).fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export async function registerUser(input: unknown, context: { ip: string | null }) {
  const data = parseOrThrow(registerSchema, input);
  await enforceRateLimit(`register:ip:${context.ip ?? "unknown"}`, RATE_LIMITS.register);

  if (data.phone && (await db.user.findUnique({ where: { phone: data.phone }, select: { id: true } }))) {
    throw invalid("This mobile number is already used by another account.", { phone: ["This mobile number is already used by another account."] });
  }

  const passwordHash = await hashPassword(data.password);
  try {
    return await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        // registerSchema only permits TENANT or OWNER, so ADMIN can never be self-assigned.
        role: data.role,
        passwordHash,
      },
      select: { id: true, role: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw invalid("An account with this email already exists.", { email: ["An account with this email already exists. Try signing in."] });
    }
    throw error;
  }
}

export async function authenticate(input: unknown, context: { ip: string | null }) {
  const data = parseOrThrow(loginSchema, input);
  await enforceRateLimit(`login:ip:${context.ip ?? "unknown"}`, RATE_LIMITS.loginPerIp);
  await enforceRateLimit(`login:account:${data.email}`, RATE_LIMITS.loginPerAccount, "Too many sign-in attempts for this account. Please wait 15 minutes or reset your password.");

  const user = await db.user.findUnique({
    where: { email: data.email },
    select: { id: true, role: true, status: true, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    // Accounts created with a one-time code may not have a password; treat them like unknown accounts.
    await verifyAgainstDummy(data.password);
    throw invalid("Incorrect email or password.");
  }
  const valid = await verifyPassword(user.passwordHash, data.password);
  if (!valid) throw invalid("Incorrect email or password.");
  if (user.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "This account has been suspended. Contact support if you think this is a mistake.");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { id: user.id, role: user.role, next: data.next };
}

/**
 * Always resolves the same way whether or not the email exists (no account enumeration).
 * Returns whether email delivery is configured so the UI can explain what happens next.
 */
export async function requestPasswordReset(input: unknown, context: { ip: string | null }) {
  const data = parseOrThrow(forgotPasswordSchema, input);
  await enforceRateLimit(`reset:ip:${context.ip ?? "unknown"}`, RATE_LIMITS.passwordResetPerIp);
  await enforceRateLimit(`reset:account:${data.email}`, RATE_LIMITS.passwordResetPerAccount);

  const user = await db.user.findUnique({ where: { email: data.email }, select: { id: true, name: true, email: true, status: true } });
  if (user?.email && user.status === "ACTIVE") {
    const { url } = await createPasswordResetLink(user.id);
    await sendEmail({
      to: user.email,
      subject: "Reset your Dhaka Resident password",
      text: `Hi ${user.name},\n\nWe received a request to reset your password. This link expires in 1 hour:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.\n\n— Dhaka Resident`,
    });
    if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
      console.info(`\n[dev] Password reset link for ${user.email} (email not configured):\n${url}\n`);
    }
  }
  return { emailConfigured: isEmailConfigured() };
}

export async function createPasswordResetLink(userId: string) {
  const token = generateToken();
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);
  return { url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`) };
}

export async function resetPassword(input: unknown) {
  const data = parseOrThrow(resetPasswordSchema, input);
  const tokenHash = hashToken(data.token);
  const passwordHash = await hashPassword(data.password);

  return db.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw invalid("This reset link is invalid or has expired. Please request a new one.");
    }
    // Mark as used atomically so a token can't be redeemed twice concurrently.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid("This reset link has already been used.");
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: record.userId } });
    return { userId: record.userId };
  });
}

export async function changePassword(userId: string, currentSessionId: string, input: unknown) {
  const data = parseOrThrow(changePasswordSchema, input);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!user.passwordHash) throw invalid("Your account doesn't have a password yet. Set one instead.");
  if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
    throw invalid("Your current password is incorrect.", { currentPassword: ["Your current password is incorrect."] });
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(data.newPassword) } });
  await deleteUserSessions(userId, currentSessionId);
}

/** Lets accounts created with a one-time code add a password. Refuses if one already exists. */
export async function setInitialPassword(userId: string, currentSessionId: string, input: unknown) {
  const data = parseOrThrow(setPasswordSchema, input);
  const passwordHash = await hashPassword(data.newPassword);
  const updated = await db.user.updateMany({ where: { id: userId, passwordHash: null }, data: { passwordHash } });
  if (updated.count !== 1) throw invalid("Your account already has a password. Use “Change password” instead.");
  await deleteUserSessions(userId, currentSessionId);
}
