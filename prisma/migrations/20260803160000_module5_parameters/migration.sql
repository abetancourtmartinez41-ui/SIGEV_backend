-- Módulo 5: Parámetros y Ajustes

-- 1) Aliados: código único (backfill desde el id para filas existentes)
ALTER TABLE "allies" ADD COLUMN "code" VARCHAR(50);
UPDATE "allies" SET "code" = 'ALY-' || UPPER(REPLACE("id"::text, '-', '')) WHERE "code" IS NULL;
ALTER TABLE "allies" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "allies_code_key" ON "allies"("code");

-- 2) Desembolsos: vigencia real (fechaInicio/fechaFin)
ALTER TABLE "disbursements" ADD COLUMN "fechaInicio" DATE;
ALTER TABLE "disbursements" ADD COLUMN "fechaFin" DATE;
UPDATE "disbursements" SET "fechaInicio" = "disbursementDate" WHERE "fechaInicio" IS NULL AND "disbursementDate" IS NOT NULL;

-- 3) Tarifas: vigencia real por rango de fechas (se deriva de la vigencia anual)
ALTER TABLE "tariffs" ADD COLUMN "fechaInicio" DATE;
ALTER TABLE "tariffs" ADD COLUMN "fechaFin" DATE;
UPDATE "tariffs" SET "fechaInicio" = MAKE_DATE("vigencyYear", 1, 1), "fechaFin" = MAKE_DATE("vigencyYear", 12, 31) WHERE "fechaInicio" IS NULL;

-- 4) Versiones de parámetros de cálculo (tasas con vigencia e historial)
CREATE TABLE "parameter_versions" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "ivaRate" DECIMAL(15,4) NOT NULL,
  "impuestoConsumoRate" DECIMAL(15,4) NOT NULL,
  "feeTarifadoRate" DECIMAL(15,4) NOT NULL,
  "feeTercerosRate" DECIMAL(15,4) NOT NULL,
  "ivaFeeRate" DECIMAL(15,4) NOT NULL,
  "applyFeeOnBase" BOOLEAN NOT NULL DEFAULT true,
  "aprobadoPor" VARCHAR(100) NOT NULL,
  "fechaInicio" DATE,
  "fechaFin" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parameter_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "parameter_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "parameter_versions" ("id","version","ivaRate","impuestoConsumoRate","feeTarifadoRate","feeTercerosRate","ivaFeeRate","applyFeeOnBase","aprobadoPor","fechaInicio","fechaFin","isActive","createdById","createdAt")
SELECT
  gen_random_uuid(), 1,
  COALESCE((SELECT "value"::DECIMAL FROM "parameters" WHERE "key" = 'IVA_RATE'), 0.19),
  COALESCE((SELECT "value"::DECIMAL FROM "parameters" WHERE "key" = 'CONSUMPTION_TAX_RATE'), 0.08),
  COALESCE((SELECT "value"::DECIMAL FROM "parameters" WHERE "key" = 'FEE_RATE'), 0.0825),
  COALESCE((SELECT "value"::DECIMAL FROM "parameters" WHERE "key" = 'FEE_RATE'), 0.0825),
  COALESCE((SELECT "value"::DECIMAL FROM "parameters" WHERE "key" = 'FEE_IVA_RATE'), 0.19),
  true, 'Sistema', NULL, NULL, true,
  (SELECT "id" FROM "users" ORDER BY "createdAt" LIMIT 1),
  NOW();
