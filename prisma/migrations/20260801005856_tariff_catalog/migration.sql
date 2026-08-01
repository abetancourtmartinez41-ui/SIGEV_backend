/*
  Warnings:

  - You are about to drop the column `municipalityCategory` on the `tariffs` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `tariffs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "items" ADD COLUMN     "isTariffed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tariffs" DROP COLUMN "municipalityCategory",
DROP COLUMN "price",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "priceEspecialPrimera" DECIMAL(15,2),
ADD COLUMN     "priceQuintaSexta" DECIMAL(15,2),
ADD COLUMN     "priceSegundaCuarta" DECIMAL(15,2),
ADD COLUMN     "sheet" VARCHAR(100),
ADD COLUMN     "tariffType" VARCHAR(20) NOT NULL DEFAULT 'TARIFADO',
ADD COLUMN     "unitMeasure" VARCHAR(50),
ADD COLUMN     "vigencyYear" INTEGER NOT NULL DEFAULT 2026,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(200);

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
