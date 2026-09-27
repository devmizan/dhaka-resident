import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { authenticate, setInitialPassword } from "@/server/services/auth";
import { otpTestHooks, startOtpLogin, startOtpSignup, startPhoneVerification, verifyOtp, verifyPhoneForUser } from "@/server/services/otp";
import { createSessionRecord, validateSessionToken } from "@/server/services/sessions";
import { updatePhone } from "@/server/services/tenant";
import { createUser, resetDatabase } from "./helpers";

const codes = new Map<string, string>();
let ipCounter = 0;
/** A fresh IP per call keeps per-IP limits from interfering between tests. */
const ctx = () => ({ ip: `192.0.2.${++ipCounter % 250}` });

beforeEach(async () => {
  await resetDatabase();
  codes.clear();
  otpTestHooks.onCodeIssued = (destination, code) => codes.set(destination, code);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => db.$disconnect());

/** Lets tests request another code without waiting for the resend cooldown. */
async function expireCooldown() {
  await db.otpChallenge.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
}

describe("sign up with a one-time code", () => {
  it("creates a verified account with a mobile number and no password", async () => {
    const start = await startOtpSignup({ name: "Arif Hossain", contact: "01712-345678", role: "OWNER", acceptTerms: true }, ctx());
    expect(start).toMatchObject({ channel: "SMS", sentTo: "+880 17••-•••678", printedToConsole: true });
    expect(await db.user.count()).toBe(0);

    const stored = await db.otpChallenge.findUniqueOrThrow({ where: { id: start.challengeId } });
    expect(stored.codeHash).not.toContain(codes.get("+8801712345678")!);

    const user = await verifyOtp({ challengeId: start.challengeId, code: codes.get("+8801712345678") }, ctx());
    expect(user).toMatchObject({ role: "OWNER", purpose: "SIGNUP" });
    const created = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(created).toMatchObject({ phone: "+8801712345678", email: null, passwordHash: null, name: "Arif Hossain" });
    expect(created.phoneVerifiedAt).not.toBeNull();

    // The code can't be used twice.
    await expect(verifyOtp({ challengeId: start.challengeId, code: codes.get("+8801712345678") }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("creates an account with an email address", async () => {
    const start = await startOtpSignup({ name: "Sadia Islam", contact: "Sadia@Example.com", role: "TENANT", acceptTerms: true }, ctx());
    const user = await verifyOtp({ challengeId: start.challengeId, code: codes.get("sadia@example.com") }, ctx());
    const created = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(created.email).toBe("sadia@example.com");
    expect(created.emailVerifiedAt).not.toBeNull();
    expect(created.role).toBe("TENANT");
  });

  it("locks the code after 5 wrong attempts, even if the right code is then entered", async () => {
    const start = await startOtpSignup({ name: "Guesser", contact: "01812345678", role: "TENANT", acceptTerms: true }, ctx());
    const right = codes.get("+8801812345678")!;
    const wrong = right === "000000" ? "111111" : "000000";
    const messages: string[] = [];
    for (let i = 0; i < 5; i++) {
      messages.push(await verifyOtp({ challengeId: start.challengeId, code: wrong }, ctx()).then(() => "verified", (e: Error) => e.message));
    }
    expect(messages[0]).toBe("Incorrect code. 4 attempts left.");
    expect(messages[4]).toBe("Too many incorrect attempts. Request a new code.");
    expect(await verifyOtp({ challengeId: start.challengeId, code: right }, ctx()).catch((e) => e.fieldErrors.code[0])).toMatch(/Too many incorrect attempts/);
    expect(await db.user.count()).toBe(0);
  });

  it("rejects expired codes", async () => {
    const start = await startOtpSignup({ name: "Late", contact: "01912345678", role: "TENANT", acceptTerms: true }, ctx());
    await db.otpChallenge.update({ where: { id: start.challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp({ challengeId: start.challengeId, code: codes.get("+8801912345678") }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses existing accounts and enforces a resend cooldown", async () => {
    await createUser("TENANT", { email: "taken@example.com" });
    await expect(startOtpSignup({ name: "Dup", contact: "taken@example.com", role: "TENANT", acceptTerms: true }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });

    await startOtpSignup({ name: "Quick", contact: "01612345678", role: "TENANT", acceptTerms: true }, ctx());
    await expect(startOtpSignup({ name: "Quick", contact: "01612345678", role: "TENANT", acceptTerms: true }, ctx())).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("limits how many codes one destination can receive per hour", async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      await expireCooldown();
      outcomes.push(await startOtpSignup({ name: "Spam", contact: "01512345678", role: "TENANT", acceptTerms: true }, ctx()).then(() => "sent", (e) => e.code));
    }
    expect(outcomes).toEqual(["sent", "sent", "sent", "sent", "sent", "RATE_LIMITED"]);
  });

  it("gives a verified number to the person who proves they own it", async () => {
    const squatter = await createUser("TENANT");
    await db.user.update({ where: { id: squatter.id }, data: { phone: "+8801312345678" } });

    const start = await startOtpSignup({ name: "Real Owner", contact: "01312345678", role: "TENANT", acceptTerms: true }, ctx());
    const user = await verifyOtp({ challengeId: start.challengeId, code: codes.get("+8801312345678") }, ctx());
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).phone).toBe("+8801312345678");
    expect((await db.user.findUniqueOrThrow({ where: { id: squatter.id } })).phone).toBeNull();
  });
});

describe("log in with a one-time code", () => {
  it("logs in by email, and by mobile only when the number is verified", async () => {
    const user = await createUser("OWNER", { email: "owner@example.com" });
    await db.user.update({ where: { id: user.id }, data: { phone: "+8801711000101" } });

    const byEmail = await startOtpLogin({ contact: "owner@example.com" }, ctx());
    await expect(verifyOtp({ challengeId: byEmail.challengeId, code: codes.get("owner@example.com") }, ctx())).resolves.toMatchObject({ id: user.id, purpose: "LOGIN" });

    // Unverified number: same response, but no code is sent and nothing can be verified.
    const unverified = await startOtpLogin({ contact: "01711-000101" }, ctx());
    expect(unverified.sentTo).toBe("+880 17••-•••101");
    expect(codes.has("+8801711000101")).toBe(false);

    await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    await expireCooldown();
    const bySms = await startOtpLogin({ contact: "01711-000101" }, ctx());
    await expect(verifyOtp({ challengeId: bySms.challengeId, code: codes.get("+8801711000101") }, ctx())).resolves.toMatchObject({ id: user.id });
  });

  it("does not reveal whether an account exists", async () => {
    await createUser("TENANT", { email: "real@example.com" });
    const known = await startOtpLogin({ contact: "real@example.com" }, ctx());
    const unknown = await startOtpLogin({ contact: "ghost@example.com" }, ctx());
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(known).sort());
    expect(codes.has("ghost@example.com")).toBe(false);

    // Cooldown applies to both, so timing of repeat requests can't be used to probe accounts either.
    await expect(startOtpLogin({ contact: "ghost@example.com" }, ctx())).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(verifyOtp({ challengeId: unknown.challengeId, code: "123456" }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("does not send codes to suspended accounts", async () => {
    await createUser("TENANT", { email: "blocked@example.com", status: "SUSPENDED" });
    await startOtpLogin({ contact: "blocked@example.com" }, ctx());
    expect(codes.has("blocked@example.com")).toBe(false);
  });

  it("lets code-only accounts add a password once, and blocks password login until then", async () => {
    const start = await startOtpSignup({ name: "Code Only", contact: "codeonly@example.com", role: "TENANT", acceptTerms: true }, ctx());
    const user = await verifyOtp({ challengeId: start.challengeId, code: codes.get("codeonly@example.com") }, ctx());

    await expect(authenticate({ email: "codeonly@example.com", password: "anything-123" }, ctx())).rejects.toThrow("Incorrect email or password.");

    const current = await createSessionRecord(user.id);
    const other = await createSessionRecord(user.id);
    const sessionId = (await validateSessionToken(current.token))!.sessionId;
    await setInitialPassword(user.id, sessionId, { newPassword: "my-new-password-1", confirmPassword: "my-new-password-1" });
    await expect(authenticate({ email: "codeonly@example.com", password: "my-new-password-1" }, ctx())).resolves.toMatchObject({ id: user.id });
    expect(await validateSessionToken(other.token)).toBeNull();

    await expect(setInitialPassword(user.id, sessionId, { newPassword: "another-pass-12", confirmPassword: "another-pass-12" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("mobile number verification from the account page", () => {
  it("verifies a new number and only for the user who requested it", async () => {
    const user = await createUser("TENANT");
    const intruder = await createUser("TENANT");
    const start = await startPhoneVerification(user.id, { phone: "01722-000222" }, ctx());
    const code = codes.get("+8801722000222")!;

    await expect(verifyPhoneForUser(intruder.id, { challengeId: start.challengeId, code }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
    await verifyPhoneForUser(user.id, { challengeId: start.challengeId, code }, ctx());
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.phone).toBe("+8801722000222");
    expect(updated.phoneVerifiedAt).not.toBeNull();

    await expect(startPhoneVerification(intruder.id, { phone: "01722000222" }, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("clears verification when the number is changed without a code, and keeps phone-only accounts reachable", async () => {
    const start = await startOtpSignup({ name: "Phone Only", contact: "01733000333", role: "TENANT", acceptTerms: true }, ctx());
    const user = await verifyOtp({ challengeId: start.challengeId, code: codes.get("+8801733000333") }, ctx());
    const actor = { id: user.id, role: user.role };

    await expect(updatePhone(actor, { phone: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await updatePhone(actor, { phone: "01733000444" });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.phone).toBe("+8801733000444");
    expect(updated.phoneVerifiedAt).toBeNull();
  });
});
