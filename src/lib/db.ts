import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Shared hosting caps how many connections one database user may hold
 * (`max_user_connections`), so the pool is deliberately small and releases idle
 * connections quickly. Raise DB_CONNECTION_LIMIT on a dedicated server.
 */
function poolConfig(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
    idleTimeout: 60,
    acquireTimeout: 20_000,
    connectTimeout: 20_000,
  };
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and start MariaDB.");
  }
  return new PrismaClient({ adapter: new PrismaMariaDb(poolConfig(connectionString)) });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
