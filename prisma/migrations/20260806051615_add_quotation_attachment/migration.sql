-- Adjunto opcional por cotización (soporte del proveedor)
ALTER TABLE "attachments" ADD COLUMN "quotationId" UUID;
CREATE INDEX "attachments_quotationId_idx" ON "attachments"("quotationId");
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
