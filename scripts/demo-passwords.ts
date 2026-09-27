/**
 * Generates fresh passwords for the sample (demo) owner and tenant accounts and prints them.
 * Useful if you lost .demo-credentials.txt. Local development only.
 *
 *   npm run demo:passwords
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { generatePassword, hashPassword } from "../src/lib/auth/password";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to reset demo passwords with NODE_ENV=production.");
    process.exit(1);
  }
  const users = await db.user.findMany({ where: { isDemo: true }, orderBy: [{ role: "asc" }, { email: "asc" }] });
  if (users.length === 0) {
    console.log("No demo accounts found. Run `npm run db:seed` first.");
    return;
  }
  const lines: string[] = [];
  for (const user of users) {
    const password = generatePassword();
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    lines.push(`${(user.role === "OWNER" ? "Owner" : "Tenant").padEnd(7)} ${user.name.padEnd(18)} ${(user.email ?? "").padEnd(30)} ${password}`);
  }
  const content = [
    "Dhaka Resident — LOCAL DEMO CREDENTIALS (development only)",
    `Generated: ${new Date().toISOString()}`,
    "",
    ...lines,
    "",
    "Sign in at http://localhost:3000/login",
  ].join("\n");
  writeFileSync(".demo-credentials.txt", `${content}\n`, { mode: 0o600 });
  console.log(`\n${content}\n\nSaved to .demo-credentials.txt\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
