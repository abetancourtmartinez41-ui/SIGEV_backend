-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "aprobadaEn" TIMESTAMPTZ,
ADD COLUMN     "aprobadaPorId" UUID,
ADD COLUMN     "validadaEn" TIMESTAMPTZ,
ADD COLUMN     "validadaPorId" UUID;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_validadaPorId_fkey" FOREIGN KEY ("validadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
