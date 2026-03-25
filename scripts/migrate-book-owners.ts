/**
 * Data migration: assign all existing books to a placeholder user.
 *
 * PURPOSE:
 *   After migration 20260325000001 (which adds a nullable ownerId column),
 *   this script creates one placeholder User record and assigns all existing
 *   books to that user. This must be run BEFORE migration step 2 (which
 *   makes ownerId required / NOT NULL).
 *
 * WHY RAW SQL:
 *   The Prisma schema has ownerId as required (String), so the generated
 *   Prisma client does not allow filtering by null on this field. At runtime
 *   (between migration 1 and migration 2), the column is still nullable in
 *   the database. Raw SQL bridges this gap.
 *
 * PREREQUISITES:
 *   - Migration 20260325000001_add_auth_tables_nullable_owner must be applied
 *   - DATABASE_URL must point to the target database
 *   - ROLLORIAN_DB_CONTEXT=local-dev (or ci-e2e-local)
 *   - ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS=true
 *
 * USAGE:
 *   npx tsx --env-file=.env.local scripts/migrate-book-owners.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { assertSafeSeedEnvironment } from "../src/lib/database-safety";

interface CountRow {
  count: bigint;
}

interface MigrationResult {
  placeholderUserId: string;
  booksUpdated: number;
}

function writeInfo(message: string): void {
  process.stdout.write(`[migrate-book-owners] ${message}\n`);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

async function countBooksWithoutOwner(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>(
    Prisma.sql`SELECT COUNT(*) AS count FROM "Book" WHERE "ownerId" IS NULL`
  );
  const row = rows[0];
  return row ? Number(row.count) : 0;
}

async function assignOwnerToBooks(
  prisma: PrismaClient,
  ownerId: string
): Promise<number> {
  const result = await prisma.$executeRaw(
    Prisma.sql`UPDATE "Book" SET "ownerId" = ${ownerId} WHERE "ownerId" IS NULL`
  );
  return result;
}

async function run(prisma: PrismaClient): Promise<MigrationResult> {
  const booksWithoutOwner = await countBooksWithoutOwner(prisma);

  if (booksWithoutOwner === 0) {
    writeInfo("No books without an owner found — nothing to migrate.");
    return { placeholderUserId: "", booksUpdated: 0 };
  }

  writeInfo(`Found ${booksWithoutOwner} book(s) without an owner.`);

  const PLACEHOLDER_EMAIL = "placeholder-owner@rollorian.local";

  // Upsert: create the placeholder user if it does not already exist
  const placeholderUser = await prisma.user.upsert({
    where: { email: PLACEHOLDER_EMAIL },
    create: {
      email: PLACEHOLDER_EMAIL,
      name: "Rollorian Placeholder Owner",
    },
    update: {},
  });

  writeInfo(`Placeholder user id: ${placeholderUser.id}`);

  const updated = await assignOwnerToBooks(prisma, placeholderUser.id);

  writeInfo(`Updated ${updated} book(s) with placeholder owner.`);

  return {
    placeholderUserId: placeholderUser.id,
    booksUpdated: updated,
  };
}

async function main(): Promise<void> {
  const connectionString = getRequiredEnv("DATABASE_URL");

  // Safety check: prevent accidental runs against production databases
  assertSafeSeedEnvironment(connectionString, process.env);

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await run(prisma);

    if (result.booksUpdated > 0) {
      writeInfo(
        `Migration complete. ${result.booksUpdated} book(s) now owned by placeholder user ${result.placeholderUserId}.`
      );
      writeInfo("You may now run migration step 2 to make ownerId required.");
    } else {
      writeInfo("Migration complete. No changes needed.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[migrate-book-owners] Fatal error:", error);
  process.exit(1);
});
