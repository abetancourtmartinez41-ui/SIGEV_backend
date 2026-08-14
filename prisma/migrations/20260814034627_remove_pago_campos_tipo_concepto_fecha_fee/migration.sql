/*
  Warnings:

  - You are about to drop the column `conceptoPago` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `feeAmount` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `feeSegmento` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payments" DROP COLUMN "conceptoPago",
DROP COLUMN "feeAmount",
DROP COLUMN "feeSegmento",
DROP COLUMN "paymentDate",
DROP COLUMN "type";
