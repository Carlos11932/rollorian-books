import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

function isDirectPostgresUrl(value: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(value);
}

function createPrismaClient() {
  const candidates = [
    env.DATABASE_URL_UNPOOLED,
    env.DIRECT_URL,
    env.DATABASE_URL,
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

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
