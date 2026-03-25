-- Make Book.ownerId NOT NULL
-- PREREQUISITE: scripts/migrate-book-owners.ts must have been run first
-- (all books must have an ownerId value before this migration can apply)

-- AlterTable
ALTER TABLE "Book" ALTER COLUMN "ownerId" SET NOT NULL;
