-- AlterTable
ALTER TABLE "events" ADD COLUMN     "disbursementId" UUID;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "disbursements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
