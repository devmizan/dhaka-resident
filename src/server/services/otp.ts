import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { OtpChannel, OtpPurpose, Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { AppError, conflict, invalid, isUniqueConstraintError } from "@/lib/errors";
import { maskEmail, maskPhone, type ContactIdentifier } from "@/lib/phone";
import { otpLoginStartSchema, otpSignupStartSchema, otpVerifySchema, phoneVerificationStartSchema } from "@/lib/validation/auth";
import { parseOrThrow } from "@/server/services/auth";
import { isEmailConfigured, sendEmail } from "@/server/services/email";
import { enforceRateLimit, RATE_LIMITS } from "@/server/services/rate-limit";
import { isSmsConfigured, sendSms } from "@/server/services/sms";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

type Context = { ip: string | null };

/** In development, codes can be printed to the server terminal when email/SMS isn't configured. */
function consoleFallbackAllowed() {
  return process.env.NODE_ENV !== "production";
}

export function getOtpAvailability() {
  const fallback = consoleFallbackAllowed();
  return {
    email: isEmailConfigured() || fallback,
    sms: isSmsConfigured() || fallback,
    emailViaConsole: !isEmailConfigured() && fallback,
    smsViaConsole: !isSmsConfigured() && fallback,
  };
}

function hashCode(challengeId: string, code: string) {
  return createHash("sha256").update(`${challengeId}.${code}`).digest("hex");
}

function generateCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function mask(contact: ContactIdentifier) {
  return contact.channel === "EMAIL" ? maskEmail(contact.destination) : maskPhone(contact.destination);
}

/** Test hook: lets integration tests read codes without a real email/SMS provider. */
export const otpTestHooks: { onCodeIssued?: (destination: string, code: string) => void } = {};

async function deliver(channel: OtpChannel, destination: string, code: string, purpose: OtpPurpose): Promise<"SENT" | "PRINTED_TO_CONSOLE"> {
  otpTestHooks.onCodeIssued?.(destination, code);
  const action = purpose === "SIGNUP" ? "create your account" : purpose === "LOGIN" ? "log in" : "verify your number";
  const configured = channel === "EMAIL" ? isEmailConfigured() : isSmsConfigured();

  if (!configured) {
    if (!consoleFallbackAllowed()) {
      throw new AppError("VALIDATION", channel === "EMAIL" ? "Codes by email aren't available right now." : "Codes by SMS aren't available right now.");
    }
    console.info(`\n[dev] One-time code for ${destination} (${channel === "EMAIL" ? "email" : "SMS"} not configured): ${code}\n`);
    return "PRINTED_TO_CONSOLE";
  }

  try {
    if (channel === "SMS") {
      await sendSms(destination, `${code} is your Dhaka Resident code to ${action}. It expires in 10 minutes. Never share it with anyone.`);
    } else {
      const status = await sendEmail({
        to: destination,
        subject: `${code} is your Dhaka Resident code`,
        text: `Your code to ${action} is:\n\n${code}\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email — nobody can use it without access to your inbox.\n\n— Dhaka Resident`,
      });
      if (status !== "SENT") throw new Error(`Email ${status.toLowerCase()}`);
    }
    return "SENT";
  } catch (error) {
    console.error("[otp delivery failed]", error instanceof Error ? error.message : error);
    throw new AppError("VALIDATION", `We couldn't send the code${channel === "SMS" ? " by SMS" : ""}. Please check the ${channel === "SMS" ? "number" : "address"} and try again.`);
  }
}

async function throttle(contact: ContactIdentifier, purpose: OtpPurpose, context: Context) {
  await enforceRateLimit(`otp:ip:${context.ip ?? "unknown"}`, RATE_LIMITS.otpSendPerIp, "Too many codes requested. Please wait a while and try again.");
  const recent = await db.otpChallenge.findFirst({
    where: { destination: contact.destination, purpose, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
    select: { createdAt: true },
  });
  if (recent) {
    const seconds = Math.ceil((recent.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
    throw new AppError("RATE_LIMITED", `Please wait ${seconds} seconds before requesting another code.`);
  }
  await enforceRateLimit(`otp:dest:${contact.destination}`, RATE_LIMITS.otpSendPerDestination, "Too many codes were sent to this address. Please try again in an hour.");
}

async function issueChallenge(input: {
  contact: ContactIdentifier;
  purpose: OtpPurpose;
  userId?: string;
  payload?: Record<string, string>;
  context: Context;
}) {
  const id = randomUUID();
  const code = generateCode();
  const deliveryStatus = await deliver(input.contact.channel, input.contact.destination, code, input.purpose);
  await db.otpChallenge.create({
    data: {
      id,
      channel: input.contact.channel,
      purpose: input.purpose,
      destination: input.contact.destination,
      codeHash: hashCode(id, code),
      payload: input.payload,
      userId: input.userId,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      deliveryStatus,
      ipAddress: input.context.ip?.slice(0, 64),
    },
  });
  if (Math.random() < 0.02) {
    await db.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }).catch(() => undefined);
  }
  return { challengeId: id, channel: input.contact.channel, sentTo: mask(input.contact), printedToConsole: deliveryStatus === "PRINTED_TO_CONSOLE" };
}

export type OtpStartResult = Awaited<ReturnType<typeof issueChallenge>>;

/** Step 1 of sign-up with a code. The account is only created once the code is verified. */
export async function startOtpSignup(input: unknown, context: Context): Promise<OtpStartResult> {
  const data = parseOrThrow(otpSignupStartSchema, input);
  const { contact } = data;

  if (contact.channel === "EMAIL") {
    if (await db.user.findUnique({ where: { email: contact.destination }, select: { id: true } })) {
      throw invalid("An account with this email already exists.", { contact: ["An account with this email already exists. Log in instead."] });
    }
  } else {
    const existing = await db.user.findUnique({ where: { phone: contact.destination }, select: { phoneVerifiedAt: true } });
    if (existing?.phoneVerifiedAt) {
      throw invalid("An account with this mobile number already exists.", { contact: ["An account with this mobile number already exists. Log in instead."] });
    }
  }

  await throttle(contact, "SIGNUP", context);
  return issueChallenge({ contact, purpose: "SIGNUP", payload: { name: data.name, role: data.role }, context });
}

/**
 * Step 1 of logging in with a code. To avoid revealing which emails and numbers are registered,
 * unknown contacts get the same response with a challenge that can never be verified.
 * Phone login requires a verified number.
 */
export async function startOtpLogin(input: unknown, context: Context): Promise<OtpStartResult> {
  const { contact } = parseOrThrow(otpLoginStartSchema, input);
  const availability = getOtpAvailability();
  if (!(contact.channel === "EMAIL" ? availability.email : availability.sms)) {
    throw invalid(contact.channel === "EMAIL" ? "Codes by email aren't available right now." : "Codes by SMS aren't available right now.");
  }
  await throttle(contact, "LOGIN", context);

  const user = await db.user.findFirst({
    where: contact.channel === "EMAIL" ? { email: contact.destination } : { phone: contact.destination, phoneVerifiedAt: { not: null } },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    // Store a placeholder that can never be verified, so cooldowns and responses look identical.
    const id = randomUUID();
    await db.otpChallenge.create({
      data: {
        id,
        channel: contact.channel,
        purpose: "LOGIN",
        destination: contact.destination,
        codeHash: randomUUID().replace(/-/g, "").padEnd(64, "0"),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        deliveryStatus: "SUPPRESSED",
        ipAddress: context.ip?.slice(0, 64),
      },
    });
    return { challengeId: id, channel: contact.channel, sentTo: mask(contact), printedToConsole: contact.channel === "EMAIL" ? availability.emailViaConsole : availability.smsViaConsole };
  }
  return issueChallenge({ contact, purpose: "LOGIN", userId: user.id, context });
}

export async function startPhoneVerification(userId: string, input: unknown, context: Context): Promise<OtpStartResult> {
  const { phone } = parseOrThrow(phoneVerificationStartSchema, input);
  const owner = await db.user.findUnique({ where: { phone }, select: { id: true, phoneVerifiedAt: true } });
  if (owner && owner.id !== userId && owner.phoneVerifiedAt) {
    throw invalid("This number is already verified on another account.", { phone: ["This number is already verified on another account."] });
  }
  const contact: ContactIdentifier = { channel: "SMS", destination: phone };
  await throttle(contact, "VERIFY_PHONE", context);
  return issueChallenge({ contact, purpose: "VERIFY_PHONE", userId, context });
}

const INVALID_CODE = "That code is invalid or has expired. Request a new code.";

/** Checks a code, consuming the challenge. Throws a friendly error for wrong, expired or reused codes. */
async function consumeChallenge(challengeId: string, code: string, context: Context) {
  await enforceRateLimit(`otp:verify:${context.ip ?? "unknown"}`, RATE_LIMITS.otpVerifyPerIp, "Too many attempts. Please wait a few minutes.");
  const challenge = await db.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) throw invalid(INVALID_CODE, { code: [INVALID_CODE] });

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const counted = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, attempts: { lt: challenge.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) {
    throw invalid("Too many incorrect attempts. Request a new code.", { code: ["Too many incorrect attempts. Request a new code."] });
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashCode(challenge.id, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const left = challenge.maxAttempts - challenge.attempts - 1;
    const message = left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Request a new code.";
    throw invalid(message, { code: [message] });
  }

  const claimed = await db.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (claimed.count !== 1) throw invalid(INVALID_CODE, { code: [INVALID_CODE] });
  return challenge;
}

export type VerifiedOtpUser = { id: string; role: Role; purpose: OtpPurpose };

/** Verifies a sign-up or login code and returns the user to start a session for. */
export async function verifyOtp(input: unknown, context: Context): Promise<VerifiedOtpUser & { next?: string }> {
  const data = parseOrThrow(otpVerifySchema, input);
  const challenge = await consumeChallenge(data.challengeId, data.code, context);
  const now = new Date();
  const isEmail = challenge.channel === "EMAIL";

  if (challenge.purpose === "SIGNUP") {
    const payload = challenge.payload as { name?: string; role?: string } | null;
    const role = payload?.role === "OWNER" ? "OWNER" : "TENANT";
    try {
      const user = await db.$transaction(async (tx) => {
        if (isEmail) {
          if (await tx.user.findUnique({ where: { email: challenge.destination }, select: { id: true } })) {
            throw conflict("An account with this email was created in the meantime. Log in instead.");
          }
        } else {
          const existing = await tx.user.findUnique({ where: { phone: challenge.destination }, select: { id: true, phoneVerifiedAt: true } });
          if (existing?.phoneVerifiedAt) throw conflict("An account with this mobile number already exists. Log in instead.");
          // The new user proved they own the number, so remove it from any account where it was never verified.
          if (existing) await tx.user.update({ where: { id: existing.id }, data: { phone: null } });
        }
        return tx.user.create({
          data: {
            name: payload?.name ?? "New member",
            role,
            ...(isEmail ? { email: challenge.destination, emailVerifiedAt: now } : { phone: challenge.destination, phoneVerifiedAt: now }),
            lastLoginAt: now,
          },
          select: { id: true, role: true },
        });
      });
      return { ...user, purpose: "SIGNUP", next: data.next };
    } catch (error) {
      if (isUniqueConstraintError(error)) throw conflict("An account with these details already exists. Log in instead.");
      throw error;
    }
  }

  if (challenge.purpose === "LOGIN" && challenge.userId) {
    const user = await db.user.findUnique({ where: { id: challenge.userId }, select: { id: true, role: true, status: true } });
    if (!user || user.status !== "ACTIVE") throw invalid(INVALID_CODE, { code: [INVALID_CODE] });
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, ...(isEmail ? { emailVerifiedAt: now } : { phoneVerifiedAt: now }) },
    });
    return { id: user.id, role: user.role, purpose: "LOGIN", next: data.next };
  }

  throw invalid(INVALID_CODE, { code: [INVALID_CODE] });
}

/** Confirms a code sent to a signed-in user's new mobile number and saves the number as verified. */
export async function verifyPhoneForUser(userId: string, input: unknown, context: Context) {
  const data = parseOrThrow(otpVerifySchema, input);
  const challenge = await db.otpChallenge.findUnique({ where: { id: data.challengeId }, select: { userId: true, purpose: true } });
  if (!challenge || challenge.userId !== userId || challenge.purpose !== "VERIFY_PHONE") throw invalid(INVALID_CODE, { code: [INVALID_CODE] });
  const verified = await consumeChallenge(data.challengeId, data.code, context);

  await db.$transaction(async (tx) => {
    const holder = await tx.user.findUnique({ where: { phone: verified.destination }, select: { id: true, phoneVerifiedAt: true } });
    if (holder && holder.id !== userId) {
      if (holder.phoneVerifiedAt) throw conflict("This number is already verified on another account.");
      await tx.user.update({ where: { id: holder.id }, data: { phone: null } });
    }
    await tx.user.update({ where: { id: userId }, data: { phone: verified.destination, phoneVerifiedAt: new Date() } });
  });
}
