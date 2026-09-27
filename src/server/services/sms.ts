/**
 * Outgoing SMS. Twilio is supported out of the box; to use a Bangladeshi gateway,
 * add a provider to `sendSms` below and select it with SMS_PROVIDER.
 */

type Provider = "twilio";

function provider(): Provider | null {
  const name = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (name === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    return "twilio";
  }
  return null;
}

export function isSmsConfigured(): boolean {
  return provider() !== null;
}

export function smsProviderName(): string | null {
  return provider();
}

export async function sendSms(to: string, body: string): Promise<void> {
  switch (provider()) {
    case "twilio": {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 200)}`);
      }
      return;
    }
    default:
      throw new Error("SMS is not configured");
  }
}
