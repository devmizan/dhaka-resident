import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return transporter;
}

export type OutgoingEmail = { to: string; subject: string; text: string };

/**
 * Sends a plain-text email. When SMTP isn't configured the email is skipped and
 * logged (without its body, which may contain tokens) so admins can see that
 * emails are not being delivered.
 */
export async function sendEmail(email: OutgoingEmail): Promise<"SENT" | "SKIPPED" | "FAILED"> {
  if (!isEmailConfigured()) {
    await db.emailLog
      .create({ data: { to: email.to, subject: email.subject, status: "SKIPPED", error: "SMTP is not configured" } })
      .catch(() => undefined);
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email skipped — SMTP not configured] to=${email.to} subject="${email.subject}"`);
    }
    return "SKIPPED";
  }
  try {
    await getTransporter().sendMail({ from: process.env.EMAIL_FROM || "Dhaka Resident <no-reply@example.com>", ...email });
    await db.emailLog.create({ data: { to: email.to, subject: email.subject, status: "SENT" } }).catch(() => undefined);
    return "SENT";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    console.error("[email failed]", message);
    await db.emailLog.create({ data: { to: email.to, subject: email.subject, status: "FAILED", error: message } }).catch(() => undefined);
    return "FAILED";
  }
}

export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
