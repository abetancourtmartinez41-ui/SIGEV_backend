-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allyId" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "allies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
