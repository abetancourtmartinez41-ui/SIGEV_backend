-- CreateTable
CREATE TABLE "oferta_economicas" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "eventId" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "allyId" UUID,
    "baseTotal" DECIMAL(15,2) NOT NULL,
    "ivaTotal" DECIMAL(15,2) NOT NULL,
    "impuestoConsumoTotal" DECIMAL(15,2) NOT NULL,
    "feeTarifadoTotal" DECIMAL(15,2) NOT NULL,
    "feeTercerosTotal" DECIMAL(15,2) NOT NULL,
    "feeTotal" DECIMAL(15,2) NOT NULL,
    "ivaFeeTotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Definitiva',
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oferta_economicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta_economica_items" (
    "id" UUID NOT NULL,
    "ofertaEconomicaId" UUID NOT NULL,
    "quotationItemId" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "baseValue" DECIMAL(15,2) NOT NULL,
    "ivaRate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "ivaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptionTaxRate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "consumptionTaxValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeRate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "feeTarifadoValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeTercerosValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeIvaRate" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "feeIvaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "allyId" UUID,
    "tariffId" UUID,
    "isTariffed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oferta_economica_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oferta_economicas_eventId_key" ON "oferta_economicas"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "oferta_economicas_quotationId_key" ON "oferta_economicas"("quotationId");

-- CreateIndex
CREATE INDEX "oferta_economica_items_ofertaEconomicaId_idx" ON "oferta_economica_items"("ofertaEconomicaId");

-- AddForeignKey
ALTER TABLE "oferta_economicas" ADD CONSTRAINT "oferta_economicas_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economicas" ADD CONSTRAINT "oferta_economicas_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economicas" ADD CONSTRAINT "oferta_economicas_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "allies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economicas" ADD CONSTRAINT "oferta_economicas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economica_items" ADD CONSTRAINT "oferta_economica_items_ofertaEconomicaId_fkey" FOREIGN KEY ("ofertaEconomicaId") REFERENCES "oferta_economicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economica_items" ADD CONSTRAINT "oferta_economica_items_quotationItemId_fkey" FOREIGN KEY ("quotationItemId") REFERENCES "quotation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economica_items" ADD CONSTRAINT "oferta_economica_items_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "allies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_economica_items" ADD CONSTRAINT "oferta_economica_items_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
