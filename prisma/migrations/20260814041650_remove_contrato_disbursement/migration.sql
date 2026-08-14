/*
  Warnings:

  - You are about to drop the column `numeroContrato` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `objetoContrato` on the `disbursements` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "disbursements" DROP COLUMN "numeroContrato",
DROP COLUMN "objetoContrato";
