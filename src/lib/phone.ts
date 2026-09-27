/**
 * Phone numbers are stored in E.164 format (+8801712345678).
 * Bangladeshi numbers can be typed the way people usually write them:
 * "01712-345678", "8801712345678", "+880 1712 345678".
 */
export const BD_MOBILE = /^\+8801[3-9]\d{8}$/;

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  const hadPlus = trimmed.startsWith("+");
  if (!hadPlus && digits.startsWith("00")) digits = digits.slice(2);

  let e164: string;
  if (!hadPlus && /^01\d{9}$/.test(digits)) e164 = `+88${digits}`;
  else if (!hadPlus && /^1[3-9]\d{8}$/.test(digits)) e164 = `+880${digits}`;
  else if (!hadPlus && /^8801\d{9}$/.test(digits)) e164 = `+${digits}`;
  else e164 = `+${digits}`;

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  // Numbers with the Bangladesh country code must be valid mobile numbers (SMS can't reach landlines).
  if (e164.startsWith("+880") && !BD_MOBILE.test(e164)) return null;
  return e164;
}

/** "+8801712345678" -> "+880 1712-345678" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const bd = e164.match(/^\+880(1\d{3})(\d{6})$/);
  if (bd) return `+880 ${bd[1]}-${bd[2]}`;
  return e164;
}

/** "+8801712345678" -> "+880 17••-•••678" for showing where a code was sent. */
export function maskPhone(e164: string): string {
  const bd = e164.match(/^\+880(1\d)(\d{2})(\d{3})(\d{3})$/);
  if (bd) return `+880 ${bd[1]}••-•••${bd[4]}`;
  return `${e164.slice(0, 4)}•••${e164.slice(-3)}`;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, Math.min(local.length - visible.length, 6)))}@${domain}`;
}

export type ContactIdentifier = { channel: "EMAIL"; destination: string } | { channel: "SMS"; destination: string };

/** Interprets "Email or mobile number" input. Returns null if it's neither. */
export function parseContactIdentifier(input: string): ContactIdentifier | null {
  const value = input.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254 ? { channel: "EMAIL", destination: email } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { channel: "SMS", destination: phone } : null;
}
