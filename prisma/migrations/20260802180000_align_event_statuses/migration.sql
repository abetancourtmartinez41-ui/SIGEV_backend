-- AlterTable
ALTER TABLE "events" ADD COLUMN "devolucionLegalizacion" BOOLEAN NOT NULL DEFAULT false;

-- Renombrar "En ejecución" vigente a "Ejecutado" ANTES de absorber "En preparación"/"En revisión"
UPDATE "events" SET "status" = 'Ejecutado' WHERE "status" = 'En ejecución';

-- Mapear estados previos de preparación/revisión al estado guía "En ejecución"
UPDATE "events" SET "status" = 'En ejecución' WHERE "status" IN ('En preparación', 'En revisión');

-- Mapear "Postulado" al estado guía "Abierto"
UPDATE "events" SET "status" = 'Abierto' WHERE "status" = 'Postulado';

-- Cambiar el valor por defecto de la columna status
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'Abierto';
