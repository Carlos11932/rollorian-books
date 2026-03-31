import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function isDirectPostgresUrl(value: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(value);
}

function createPrismaClient() {
  const candidates = [
    process.env["DATABASE_URL_UNPOOLED"],
    process.env["DIRECT_URL"],
    process.env["DATABASE_URL"],
  ].filter((value): value is string => value != null && value.length > 0);

  const connectionString = candidates.find(isDirectPostgresUrl);

  if (!connectionString) {
    throw new Error(
      "A direct Postgres datasource URL is required for PrismaPg (use DATABASE_URL_UNPOOLED or DIRECT_URL, or a postgres:// DATABASE_URL)",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
