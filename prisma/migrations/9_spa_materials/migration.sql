-- CreateEnum
CREATE TYPE "MaterialSource" AS ENUM ('SHARED_STOCK', 'CUSTOMER_OWNED');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('IN_USE', 'LOW', 'EMPTY', 'DISPOSED');

-- CreateEnum
CREATE TYPE "CustomerMaterialStatus" AS ENUM ('ACTIVE', 'USED_UP', 'CANCELLED');

-- CreateTable
CREATE TABLE "usage_materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "serviceId" TEXT,
    "technologyId" TEXT,
    "brandProtocolId" TEXT,
    "expectedPerSession" DECIMAL(14,3),
    "lowThreshold" DECIMAL(14,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_containers" (
    "id" TEXT NOT NULL,
    "usageMaterialId" TEXT NOT NULL,
    "containerNo" TEXT NOT NULL,
    "initialQty" DECIMAL(14,3) NOT NULL,
    "remainingQty" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "costSnapshot" DECIMAL(18,2),
    "openedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "ContainerStatus" NOT NULL DEFAULT 'IN_USE',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "allocatedQty" DECIMAL(14,3) NOT NULL,
    "usedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,2),
    "planId" TEXT,
    "brandProtocolId" TEXT,
    "status" "CustomerMaterialStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usages" (
    "id" TEXT NOT NULL,
    "source" "MaterialSource" NOT NULL,
    "containerId" TEXT,
    "customerMaterialId" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "performedBy" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(18,2),
    "costAllocated" DECIMAL(18,2),
    "serviceId" TEXT,
    "technologyId" TEXT,
    "brandProtocolId" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_materials_code_key" ON "usage_materials"("code");

-- CreateIndex
CREATE INDEX "usage_materials_isActive_idx" ON "usage_materials"("isActive");

-- CreateIndex
CREATE INDEX "material_containers_usageMaterialId_idx" ON "material_containers"("usageMaterialId");

-- CreateIndex
CREATE INDEX "material_containers_status_idx" ON "material_containers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_materials_code_key" ON "customer_materials"("code");

-- CreateIndex
CREATE INDEX "customer_materials_customerId_idx" ON "customer_materials"("customerId");

-- CreateIndex
CREATE INDEX "material_usages_sessionId_idx" ON "material_usages"("sessionId");

-- CreateIndex
CREATE INDEX "material_usages_customerId_idx" ON "material_usages"("customerId");

-- CreateIndex
CREATE INDEX "material_usages_containerId_idx" ON "material_usages"("containerId");

-- CreateIndex
CREATE INDEX "material_usages_customerMaterialId_idx" ON "material_usages"("customerMaterialId");

-- CreateIndex
CREATE INDEX "material_usages_occurredAt_idx" ON "material_usages"("occurredAt");

-- AddForeignKey
ALTER TABLE "material_containers" ADD CONSTRAINT "material_containers_usageMaterialId_fkey" FOREIGN KEY ("usageMaterialId") REFERENCES "usage_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_materials" ADD CONSTRAINT "customer_materials_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "material_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_customerMaterialId_fkey" FOREIGN KEY ("customerMaterialId") REFERENCES "customer_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

