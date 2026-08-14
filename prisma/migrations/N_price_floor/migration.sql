-- CreateEnum
CREATE TYPE "FloorMethod" AS ENUM ('MARGIN', 'MARKUP', 'MANUAL');

-- CreateEnum
CREATE TYPE "FloorVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('MATERIAL', 'STAFF', 'MACHINE', 'ROOM', 'OPERATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCalcType" AS ENUM ('FIXED', 'PER_MINUTE', 'PER_SESSION', 'PER_USE', 'PERCENT_DIRECT', 'PER_DURATION');

-- CreateTable
CREATE TABLE "service_price_floor_versions" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FloorVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "method" "FloorMethod" NOT NULL DEFAULT 'MARGIN',
    "minMarginPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "manualFloorPrice" DECIMAL(18,2),
    "roundingUnit" INTEGER NOT NULL DEFAULT 1000,
    "durationMinutes" INTEGER,
    "standardPriceSnapshot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "staffCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "machineCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roomCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "operationCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "floorPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxDiscountPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "changeReason" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_price_floor_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_floor_cost_lines" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calcType" "CostCalcType" NOT NULL DEFAULT 'FIXED',
    "calcValue" DECIMAL(18,2),
    "minutes" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refId" TEXT,
    "source" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "price_floor_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "below_floor_approvals" (
    "id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "serviceId" TEXT,
    "floorVersionId" TEXT,
    "proposalId" TEXT,
    "invoiceId" TEXT,
    "itemName" TEXT,
    "standardPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "floorPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "actualPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "belowAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "belowPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "below_floor_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_price_floor_versions_serviceId_status_idx" ON "service_price_floor_versions"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_price_floor_versions_serviceId_version_key" ON "service_price_floor_versions"("serviceId", "version");

-- CreateIndex
CREATE INDEX "price_floor_cost_lines_versionId_idx" ON "price_floor_cost_lines"("versionId");

-- CreateIndex
CREATE INDEX "below_floor_approvals_serviceId_idx" ON "below_floor_approvals"("serviceId");

-- CreateIndex
CREATE INDEX "below_floor_approvals_proposalId_idx" ON "below_floor_approvals"("proposalId");

-- AddForeignKey
ALTER TABLE "service_price_floor_versions" ADD CONSTRAINT "service_price_floor_versions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_floor_cost_lines" ADD CONSTRAINT "price_floor_cost_lines_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "service_price_floor_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

