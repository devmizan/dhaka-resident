import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read lazily so `prisma generate` (run on npm install) works before .env exists.
    // Commands that need a database still fail with a clear connection error if it's missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
