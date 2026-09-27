/**
 * One-command local setup:
 *   1. applies database migrations
 *   2. seeds reference data and sample content (with generated demo passwords)
 *   3. creates a local administrator if none exists (generated password, printed once)
 *
 *   npm run setup
 *   npm run setup -- --admin-email you@example.com
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { db } from "../src/lib/db";
import { createAdmin } from "./create-admin";

function run(command: string) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit" });
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Copy .env.example to .env first.");
    process.exit(1);
  }
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    console.error("\n✖ Can't connect to PostgreSQL. Start it with `docker compose up -d` (or check DATABASE_URL in .env).\n");
    process.exit(1);
  }

  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");

  const admins = await db.user.count({ where: { role: "ADMIN" } });
  let adminSummary = "An administrator already exists. Reset its password with: npm run admin:create -- --email <email> --reset-password";
  if (admins === 0) {
    const email = arg("admin-email") ?? "admin@example.com";
    const result = await createAdmin({ email, name: "Local Administrator", quiet: true });
    adminSummary = `Admin   ${result.email.padEnd(30)} ${result.password}   (shown once — not saved to disk)`;
  }

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" Dhaka Resident is ready for local development");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(` ${adminSummary}`);
  console.log(" Owner and tenant demo passwords: see the table above or .demo-credentials.txt");
  console.log("");
  console.log(" Start the app:   npm run dev");
  console.log(` Website:         ${base}`);
  console.log(` Admin login:     ${base}/login?next=/admin`);
  console.log(` Owner login:     ${base}/login?next=/dashboard/listings`);
  console.log(` Tenant login:    ${base}/login?next=/dashboard/saved`);
  console.log("══════════════════════════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
