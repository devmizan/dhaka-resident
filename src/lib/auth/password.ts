import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spend comparable time when an account doesn't exist, to avoid leaking which emails are registered. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hash("dummy-password-for-timing", OPTIONS);
  await verifyPassword(await dummyHash, password);
}

/** Generates a readable random password (used for generated demo/admin credentials). */
export function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  // Group for readability: xxxxx-xxxxx-xxxxx-xxxxx
  return out.match(/.{1,5}/g)!.join("-");
}
