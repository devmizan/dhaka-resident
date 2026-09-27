import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { authenticate, changePassword, createPasswordResetLink, registerUser, requestPasswordReset, resetPassword } from "@/server/services/auth";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { createSessionRecord, validateSessionToken } from "@/server/services/sessions";
import { createUser, resetDatabase, TEST_PASSWORD } from "./helpers";

const ip = { ip: "203.0.113.10" };

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe("registration", () => {
  it("creates tenant and owner accounts with hashed passwords", async () => {
    const user = await registerUser(
      { name: "Arif Hossain", email: "Arif@Example.com", role: "OWNER", password: "a-good-password-1", confirmPassword: "a-good-password-1", acceptTerms: true },
      ip,
    );
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.email).toBe("arif@example.com");
    expect(stored.role).toBe("OWNER");
    expect(stored.passwordHash).not.toContain("a-good-password-1");
    expect(stored.passwordHash?.startsWith("$argon2id$")).toBe(true);
  });

  it("refuses to create an admin through registration", async () => {
    await expect(
      registerUser({ name: "Mallory", email: "mallory@example.com", role: "ADMIN", password: "a-good-password-1", confirmPassword: "a-good-password-1", acceptTerms: true }, ip),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(0);
  });

  it("reports duplicate emails as a field error", async () => {
    await createUser("TENANT", { email: "taken@example.com" });
    const error = await registerUser(
      { name: "Someone", email: "taken@example.com", role: "TENANT", password: "a-good-password-1", confirmPassword: "a-good-password-1", acceptTerms: true },
      ip,
    ).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.fieldErrors.email).toBeDefined();
  });
});

describe("login and sessions", () => {
  it("authenticates with the right password only", async () => {
    await createUser("TENANT", { email: "sadia@example.com" });
    await expect(authenticate({ email: "sadia@example.com", password: "wrong-password" }, ip)).rejects.toThrow("Incorrect email or password.");
    await expect(authenticate({ email: "nobody@example.com", password: TEST_PASSWORD }, ip)).rejects.toThrow("Incorrect email or password.");
    const ok = await authenticate({ email: "SADIA@example.com", password: TEST_PASSWORD }, ip);
    expect(ok.role).toBe("TENANT");
  });

  it("blocks suspended accounts", async () => {
    await createUser("OWNER", { email: "suspended@example.com", status: "SUSPENDED" });
    await expect(authenticate({ email: "suspended@example.com", password: TEST_PASSWORD }, ip)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate-limits repeated failed logins for an account", async () => {
    await createUser("TENANT", { email: "target@example.com" });
    const attempts = [];
    for (let i = 0; i < 9; i++) {
      attempts.push(await authenticate({ email: "target@example.com", password: "nope" }, { ip: `198.51.100.${i}` }).catch((e: AppError) => e.code));
    }
    expect(attempts.slice(0, 8).every((code) => code === "VALIDATION")).toBe(true);
    expect(attempts[8]).toBe("RATE_LIMITED");
  });

  it("stores only a hash of the session token and rejects expired sessions", async () => {
    const user = await createUser("TENANT");
    const { token } = await createSessionRecord(user.id);
    expect(await db.session.count({ where: { id: token } })).toBe(0);
    expect((await validateSessionToken(token))?.user.id).toBe(user.id);

    await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await validateSessionToken("forged-token")).toBeNull();
  });

  it("invalidates sessions of suspended users", async () => {
    const user = await createUser("TENANT");
    const { token } = await createSessionRecord(user.id);
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    expect(await validateSessionToken(token)).toBeNull();
  });
});

describe("password reset", () => {
  it("does not reveal whether an email is registered", async () => {
    await expect(requestPasswordReset({ email: "ghost@example.com" }, ip)).resolves.toEqual({ emailConfigured: false });
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  it("resets a password once with a valid token and signs out everywhere", async () => {
    const user = await createUser("OWNER", { email: "owner@example.com" });
    await createSessionRecord(user.id);
    const { url } = await createPasswordResetLink(user.id);
    const token = new URL(url).searchParams.get("token")!;

    await resetPassword({ token, password: "brand-new-pass-9", confirmPassword: "brand-new-pass-9" });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(authenticate({ email: "owner@example.com", password: "brand-new-pass-9" }, ip)).resolves.toBeTruthy();

    await expect(resetPassword({ token, password: "another-pass-99", confirmPassword: "another-pass-99" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires the current password to change it", async () => {
    const user = await createUser("TENANT", { email: "change@example.com" });
    const current = await createSessionRecord(user.id);
    const other = await createSessionRecord(user.id);
    const currentId = (await validateSessionToken(current.token))!.sessionId;

    await expect(changePassword(user.id, currentId, { currentPassword: "wrong", newPassword: "fresh-password-1", confirmPassword: "fresh-password-1" })).rejects.toMatchObject({ code: "VALIDATION" });
    await changePassword(user.id, currentId, { currentPassword: TEST_PASSWORD, newPassword: "fresh-password-1", confirmPassword: "fresh-password-1" });
    expect(await validateSessionToken(current.token)).not.toBeNull();
    expect(await validateSessionToken(other.token)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window, atomically under concurrency", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit("test:concurrent", { limit: 5, windowMs: 60_000 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});
