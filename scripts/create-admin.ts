/**
 * Creates an administrator account (or resets an existing admin's password).
 *
 *   npm run admin:create                              # prompts for email and name
 *   npm run admin:create -- --email you@company.com --name "Your Name"
 *   npm run admin:create -- --email you@company.com --reset-password
 *
 * A strong random password is generated and printed once. It is never stored in plain text.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db } from "../src/lib/db";
import { generatePassword, hashPassword } from "../src/lib/auth/password";
import { emailField } from "../src/lib/validation/auth";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

const flag = (name: string) => process.argv.includes(`--${name}`);

export async function createAdmin(options: { email: string; name: string; resetPassword?: boolean; quiet?: boolean }) {
  const email = emailField.parse(options.email);
  const existing = await db.user.findUnique({ where: { email } });
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  if (existing) {
    if (existing.role !== "ADMIN") {
      throw new Error(`${email} already exists as a ${existing.role.toLowerCase()} account. Promote it from the admin dashboard, or use a different email.`);
    }
    if (!options.resetPassword) {
      throw new Error(`An admin with ${email} already exists. Add --reset-password to generate a new password.`);
    }
    await db.$transaction([
      db.user.update({ where: { id: existing.id }, data: { passwordHash, status: "ACTIVE" } }),
      db.session.deleteMany({ where: { userId: existing.id } }),
    ]);
  } else {
    const user = await db.user.create({ data: { email, name: options.name, role: "ADMIN", passwordHash } });
    await db.adminActivity.create({
      data: { actorId: null, action: "user.admin_created", entityType: "User", entityId: user.id, summary: `Administrator ${email} created from the command line` },
    });
  }

  if (!options.quiet) {
    console.log("\n┌─ Administrator account ─────────────────────────────────────");
    console.log(`│ Email:    ${email}`);
    console.log(`│ Password: ${password}`);
    console.log(`│ Sign in:  ${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/login?next=/admin`);
    console.log("└─────────────────────────────────────────────────────────────");
    console.log("This password is shown only once. Store it in a password manager.\n");
  }
  return { email, password, created: !existing };
}

async function main() {
  let email = arg("email");
  let name = arg("name");
  if (!email || (!name && !flag("reset-password"))) {
    if (!stdin.isTTY) {
      console.error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--reset-password]');
      process.exit(1);
    }
    const rl = createInterface({ input: stdin, output: stdout });
    email ??= (await rl.question("Admin email: ")).trim();
    if (!flag("reset-password")) name ??= (await rl.question("Admin name: ")).trim() || "Administrator";
    rl.close();
  }
  await createAdmin({ email: email!, name: name ?? "Administrator", resetPassword: flag("reset-password") });
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/create-admin.ts")) {
  main()
    .catch((error) => {
      console.error(`\n✖ ${error instanceof Error ? error.message : error}\n`);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
