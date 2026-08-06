-- Ajuste de precisión de tasas (4 decimales) en ítems de eventos y de cotización
ALTER TABLE "items" ALTER COLUMN "ivaRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "items" ALTER COLUMN "consumptionTaxRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "items" ALTER COLUMN "feeRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "items" ALTER COLUMN "feeIvaRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "quotation_items" ALTER COLUMN "ivaRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "quotation_items" ALTER COLUMN "consumptionTaxRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "quotation_items" ALTER COLUMN "feeRate" SET DATA TYPE DECIMAL(15,4);
ALTER TABLE "quotation_items" ALTER COLUMN "feeIvaRate" SET DATA TYPE DECIMAL(15,4);
