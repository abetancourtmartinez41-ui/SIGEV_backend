-- AlterTable
ALTER TABLE "events" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
