-- AlterTable
ALTER TABLE "events" ADD COLUMN     "attendees" INTEGER DEFAULT 0,
ADD COLUMN     "days" INTEGER DEFAULT 0,
ADD COLUMN     "dependency" VARCHAR(100),
ADD COLUMN     "hamlet" VARCHAR(200);
