/* Non-interactive entry point used by the deployment bundle (see npm run build:scripts). */
import "dotenv/config";
import { db } from "../src/lib/db";
import { createAdmin } from "./create-admin";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  return index === -1 || !value || value.startsWith("--") ? undefined : value;
}

const email = arg("email");
if (!email) {
  console.error('Usage: node create-admin.mjs --email you@example.com --name "Your Name" [--reset-password]');
  process.exit(1);
}

try {
  await createAdmin({ email, name: arg("name") ?? "Administrator", resetPassword: process.argv.includes("--reset-password") });
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
