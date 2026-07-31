-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "document" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'Abierto',
    "startDate" DATE,
    "endDate" DATE,
    "divipolaCode" VARCHAR(10),
    "municipalityName" VARCHAR(100),
    "municipalityCategory" VARCHAR(50),
    "generalAllyId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "baseValue" DECIMAL(15,2) NOT NULL,
    "ivaRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ivaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptionTaxRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptionTaxValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeIvaRate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "feeIvaValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "allyId" UUID,
    "tariffId" UUID,
    "eventId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedPath" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(50) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" VARCHAR(100),
    "eventId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parameters" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "document" VARCHAR(20),
    "contactName" VARCHAR(100),
    "contactEmail" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "allies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "year" INTEGER NOT NULL,
    "disbursementDate" DATE,
    "status" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "price" DECIMAL(15,2) NOT NULL,
    "municipalityCategory" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "userId" UUID NOT NULL,
    "userEmail" VARCHAR(100),
    "ipAddress" INET,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "id" UUID NOT NULL,
    "divipolaCode" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_document_key" ON "users"("document");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE UNIQUE INDEX "parameters_key_key" ON "parameters"("key");

-- CreateIndex
CREATE UNIQUE INDEX "allies_name_key" ON "allies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_divipolaCode_key" ON "municipalities"("divipolaCode");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
