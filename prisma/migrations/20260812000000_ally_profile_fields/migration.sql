-- Perfil del Aliado: columnas existentes en BD pero no registradas en el historial de migraciones.
ALTER TABLE "allies" ADD COLUMN "documentType" VARCHAR(10);
ALTER TABLE "allies" ADD COLUMN "phone" VARCHAR(20);
ALTER TABLE "allies" ADD COLUMN "divipolaCode" VARCHAR(10);
ALTER TABLE "allies" ADD COLUMN "divipolaDepartment" VARCHAR(100);
