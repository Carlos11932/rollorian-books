-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('OWNED', 'NOT_OWNED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "UserBook" ADD COLUMN "ownershipStatus" "OwnershipStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "UserBook_userId_ownershipStatus_idx" ON "UserBook"("userId", "ownershipStatus");
