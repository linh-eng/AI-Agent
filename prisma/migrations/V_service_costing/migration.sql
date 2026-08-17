-- CreateEnum
CREATE TYPE "CostingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CostAllocationType" AS ENUM ('MANUAL', 'FIXED_PER_SERVICE', 'PER_MINUTE');

-- CreateTable
CREATE TABLE "service_costing_versions" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostingStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceVersionSnapshot" INTEGER,
    "durationMinutes" INTEGER,
    "computedMaterialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "materialOverride" DECIMAL(18,2),
    "materialOverrideReason" TEXT,
    "finalMaterialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "equipmentCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "facilityCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overheadMethod" "CostAllocationType" NOT NULL DEFAULT 'MANUAL',
    "overheadValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overheadCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "directCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEstimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceSnapshot" JSONB,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,

    CONSTRAINT "service_costing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_costing_versions_serviceId_status_idx" ON "service_costing_versions"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_costing_versions_serviceId_version_key" ON "service_costing_versions"("serviceId", "version");

-- AddForeignKey
ALTER TABLE "service_costing_versions" ADD CONSTRAINT "service_costing_versions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

