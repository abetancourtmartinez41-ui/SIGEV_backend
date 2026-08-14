-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "paymentId" UUID;

-- AlterTable
ALTER TABLE "disbursements" ADD COLUMN     "numeroContrato" VARCHAR(100),
ADD COLUMN     "objetoContrato" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "conceptoPago" VARCHAR(30),
ADD COLUMN     "esAdicional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feeAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "feeSegmento" VARCHAR(20),
ADD COLUMN     "method" VARCHAR(20);

-- CreateTable
CREATE TABLE "payment_items" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_items_paymentId_idx" ON "payment_items"("paymentId");

-- CreateIndex
CREATE INDEX "payment_items_itemId_idx" ON "payment_items"("itemId");

-- CreateIndex
CREATE INDEX "attachments_paymentId_idx" ON "attachments"("paymentId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
