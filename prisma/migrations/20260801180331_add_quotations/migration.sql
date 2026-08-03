-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "allyId" UUID,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "quotationDate" DATE,
    "validityDays" INTEGER,
    "isDefinitive" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "createdById" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_allyId_fkey" FOREIGN KEY ("allyId") REFERENCES "allies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
