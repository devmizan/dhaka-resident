import "dotenv/config";
import { execSync } from "node:child_process";

/** Applies migrations to the dedicated test database before the integration suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Copy it from .env.example (the Docker database creates dhaka_resident_test automatically).");
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must point to a different database than DATABASE_URL — tests delete all data.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
