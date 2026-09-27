import "dotenv/config";

// Point the shared Prisma client at the test database before any application module loads.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
// Never send real email from tests.
process.env.SMTP_HOST = "";
