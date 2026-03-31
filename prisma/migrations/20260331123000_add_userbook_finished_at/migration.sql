-- AlterTable
ALTER TABLE "UserBook"
ADD COLUMN "finishedAt" TIMESTAMP(3);

-- Backfill existing completed books with the best available completion proxy
UPDATE "UserBook"
SET "finishedAt" = "updatedAt"
WHERE "status" = 'READ'
  AND "finishedAt" IS NULL;
