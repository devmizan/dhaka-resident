import { z } from "zod";
import { normalizePhone, parseContactIdentifier } from "@/lib/phone";
import { optionalText, text } from "@/lib/validation/common";

export const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254, "Email is too long"));

export const passwordField = z
  .string({ error: "Password is required" })
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), "Include at least one letter and one number");

/** Optional phone number, normalised to E.164 (e.g. "01712-345678" becomes "+8801712345678"). */
export const phoneField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .max(30, "Enter a valid mobile number, e.g. 01712-345678")
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 01712-345678" });
        return z.NEVER;
      }
      return phone;
    })
    .optional(),
);

/** "Email or mobile number" for one-time codes. */
export const contactField = z
  .string({ error: "Enter your email or mobile number" })
  .max(254)
  .transform((value, ctx) => {
    const contact = parseContactIdentifier(value);
    if (!contact) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address or mobile number, e.g. 01712-345678" });
      return z.NEVER;
    }
    return contact;
  });

export const otpCodeField = z
  .string({ error: "Enter the 6-digit code" })
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code"));

/** Only these roles can be chosen at sign-up. Admin accounts are created by the setup command or an existing admin. */
export const SELF_SERVICE_ROLES = ["TENANT", "OWNER"] as const;

export const registerSchema = z
  .object({
    name: text("Name", 2, 80),
    email: emailField,
    phone: phoneField,
    role: z.enum(SELF_SERVICE_ROLES, "Choose how you'll use Dhaka Resident"),
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, "You need to accept the terms to create an account"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required").max(128),
  next: z.string().max(300).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(128),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

/** For accounts created with a one-time code that don't have a password yet. */
export const setPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

// ─── One-time codes ──────────────────────────────────────────

export const otpSignupStartSchema = z.object({
  name: text("Name", 2, 80),
  contact: contactField,
  role: z.enum(SELF_SERVICE_ROLES, "Choose how you'll use Dhaka Resident"),
  acceptTerms: z.literal(true, "You need to accept the terms to create an account"),
});

export const otpLoginStartSchema = z.object({
  contact: contactField,
});

export const otpVerifySchema = z.object({
  challengeId: z.string().min(10).max(64),
  code: otpCodeField,
  next: z.string().max(300).optional(),
});

export const phoneVerificationStartSchema = z.object({
  phone: z
    .string({ error: "Enter your mobile number" })
    .max(30)
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 01712-345678" });
        return z.NEVER;
      }
      return phone;
    }),
});

export const profileSchema = z.object({
  name: text("Name", 2, 80),
  companyName: optionalText("Company name", 120),
  bio: optionalText("About", 1000),
});

/** Saves a mobile number without verification (used when SMS delivery isn't available). */
export const phoneUpdateSchema = z.object({ phone: phoneField });

export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  notifyEnquiries: z.boolean(),
  notifyViewings: z.boolean(),
  notifyListing: z.boolean(),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
