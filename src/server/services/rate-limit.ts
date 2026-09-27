import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type RateLimitPolicy = { limit: number; windowMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RATE_LIMITS = {
  loginPerAccount: { limit: 8, windowMs: 15 * MINUTE },
  loginPerIp: { limit: 40, windowMs: 15 * MINUTE },
  register: { limit: 6, windowMs: HOUR },
  passwordResetPerIp: { limit: 6, windowMs: HOUR },
  passwordResetPerAccount: { limit: 3, windowMs: HOUR },
  enquiry: { limit: 10, windowMs: HOUR },
  message: { limit: 60, windowMs: HOUR },
  viewingRequest: { limit: 10, windowMs: HOUR },
  report: { limit: 10, windowMs: 24 * HOUR },
  upload: { limit: 80, windowMs: HOUR },
  otpSendPerDestination: { limit: 5, windowMs: HOUR },
  otpSendPerIp: { limit: 20, windowMs: HOUR },
  otpVerifyPerIp: { limit: 40, windowMs: 15 * MINUTE },
} satisfies Record<string, RateLimitPolicy>;

/**
 * Fixed-window rate limiter stored in the database, so limits hold across restarts
 * and multiple app instances.
 *
 * The counter is bumped by a single atomic `INSERT … ON DUPLICATE KEY UPDATE`, and the
 * resulting value is read back inside the same transaction (which pins one connection),
 * so concurrent callers can't share a count.
 */
export async function consumeRateLimit(key: string, policy: RateLimitPolicy): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const expires = new Date(now.getTime() + policy.windowMs);
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO \`RateLimitBucket\` (\`key\`, \`count\`, \`windowStart\`, \`expiresAt\`)
      VALUES (${key}, 1, ${now}, ${expires})
      ON DUPLICATE KEY UPDATE
        \`count\` = IF(\`expiresAt\` <= ${now}, 1, \`count\` + 1),
        \`windowStart\` = IF(\`expiresAt\` <= ${now}, ${now}, \`windowStart\`),
        \`expiresAt\` = IF(\`expiresAt\` <= ${now}, ${expires}, \`expiresAt\`)`;
    const rows = await tx.$queryRaw<{ count: number; expiresAt: Date }[]>`
      SELECT \`count\`, \`expiresAt\` FROM \`RateLimitBucket\` WHERE \`key\` = ${key}`;
    return rows[0]!;
  });

  // Opportunistic cleanup of stale buckets.
  if (Math.random() < 0.01) {
    await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => undefined);
  }

  const allowed = row.count <= policy.limit;
  return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)) };
}

export async function enforceRateLimit(key: string, policy: RateLimitPolicy, message?: string) {
  const result = await consumeRateLimit(key, policy);
  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60);
    throw new AppError(
      "RATE_LIMITED",
      message ?? `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }
}
