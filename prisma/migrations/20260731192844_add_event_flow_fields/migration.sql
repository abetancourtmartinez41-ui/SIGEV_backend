-- AlterTable
ALTER TABLE "events" ADD COLUMN     "authorizeException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observation" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Postulado';
