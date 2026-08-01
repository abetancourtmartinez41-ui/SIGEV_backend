-- Backfill: sufijos NULL pasan a cadena vacia
UPDATE "events" SET "suffix" = '' WHERE "suffix" IS NULL;

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "suffix" SET DEFAULT '',
ALTER COLUMN "suffix" SET NOT NULL,
ADD COLUMN "schemaType" VARCHAR(20) NOT NULL DEFAULT 'cotizacion';

-- DropIndex
DROP INDEX "events_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "events_code_suffix_key" ON "events"("code", "suffix");
