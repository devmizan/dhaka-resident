import { describe, expect, it } from "vitest";
import { formatPhone, maskEmail, maskPhone, normalizePhone, parseContactIdentifier } from "@/lib/phone";
import { otpSignupStartSchema, otpVerifySchema, registerSchema } from "@/lib/validation/auth";

describe("normalizePhone", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["01712-345678", "+8801712345678"],
    ["+880 1712-345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["008801712345678", "+8801712345678"],
    ["1712345678", "+8801712345678"],
    ["+44 7700 900123", "+447700900123"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "0171234", "+880 2 9876543", "01212345678", "+0123456789", "call me"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formats and masks numbers for display", () => {
    expect(formatPhone("+8801712345678")).toBe("+880 1712-345678");
    expect(maskPhone("+8801712345678")).toBe("+880 17••-•••678");
    expect(maskEmail("sadia.islam@example.com")).toBe("sa••••••@example.com");
  });
});

describe("contact identifiers", () => {
  it("detects email or mobile", () => {
    expect(parseContactIdentifier(" Sadia@Example.com ")).toEqual({ channel: "EMAIL", destination: "sadia@example.com" });
    expect(parseContactIdentifier("01712-345678")).toEqual({ channel: "SMS", destination: "+8801712345678" });
    expect(parseContactIdentifier("not-an-email@")).toBeNull();
    expect(parseContactIdentifier("12345")).toBeNull();
  });
});

describe("one-time code schemas", () => {
  it("validates sign-up details and never allows the admin role", () => {
    const base = { name: "Arif Hossain", contact: "01712345678", role: "TENANT", acceptTerms: true };
    expect(otpSignupStartSchema.parse(base).contact).toEqual({ channel: "SMS", destination: "+8801712345678" });
    expect(otpSignupStartSchema.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
    expect(otpSignupStartSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });

  it("accepts 6-digit codes with spaces and rejects others", () => {
    expect(otpVerifySchema.parse({ challengeId: "0f8fad5b-d9cb-469f-a165", code: "123 456" }).code).toBe("123456");
    expect(otpVerifySchema.safeParse({ challengeId: "0f8fad5b-d9cb-469f-a165", code: "12345" }).success).toBe(false);
    expect(otpVerifySchema.safeParse({ challengeId: "0f8fad5b-d9cb-469f-a165", code: "abcdef" }).success).toBe(false);
  });

  it("normalises the optional phone on password registration", () => {
    const parsed = registerSchema.parse({ name: "Sadia", email: "s@example.com", phone: "01812-000111", role: "TENANT", password: "long-enough-1", confirmPassword: "long-enough-1", acceptTerms: true });
    expect(parsed.phone).toBe("+8801812000111");
    expect(registerSchema.safeParse({ name: "Sadia", email: "s@example.com", phone: "12", role: "TENANT", password: "long-enough-1", confirmPassword: "long-enough-1", acceptTerms: true }).success).toBe(false);
  });
});
