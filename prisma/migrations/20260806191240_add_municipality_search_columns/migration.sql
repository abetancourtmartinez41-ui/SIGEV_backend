-- AlterTable
ALTER TABLE "municipalities" ADD COLUMN     "normalizedDepartment" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "normalizedName" VARCHAR(100) NOT NULL DEFAULT '';
