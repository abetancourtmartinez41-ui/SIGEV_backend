-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "code" VARCHAR(50);
UPDATE "quotations" SET "code" = 'COT-' || LEFT("id"::text, 8) WHERE "code" IS NULL;
ALTER TABLE "quotations" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "quotations" ADD COLUMN "name" VARCHAR(200);
UPDATE "quotations" SET "name" = 'Oferta ' || "code" WHERE "name" IS NULL;
ALTER TABLE "quotations" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "quotations" ADD COLUMN "description" TEXT;
ALTER TABLE "quotations" ADD COLUMN "cliente" VARCHAR(200);
ALTER TABLE "quotations" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'Borrador';

-- AlterTable
ALTER TABLE "events" ADD COLUMN "cotizacionSeleccionadaId" UUID;
CREATE UNIQUE INDEX "events_cotizacionSeleccionadaId_key" ON "events"("cotizacionSeleccionadaId");

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "ivaRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ivaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptionTaxRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptionTaxValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeIvaRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeIvaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "allyId" UUID,
    "tariffId" UUID,
    "isTariffed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "allies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cotizacionSeleccionadaId_fkey" FOREIGN KEY ("cotizacionSeleccionadaId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
