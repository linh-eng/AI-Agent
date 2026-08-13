-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "defaultProtocolId" TEXT,
ADD COLUMN     "defaultTechnologyId" TEXT,
ADD COLUMN     "machineMinutes" INTEGER,
ADD COLUMN     "protocolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resourceRequirements" JSONB,
ADD COLUMN     "roomMinutes" INTEGER,
ADD COLUMN     "staffRequirements" JSONB,
ADD COLUMN     "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "technologyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "service_material_standards" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "spaProductId" TEXT,
    "usageMaterialId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_material_standards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_material_standards_serviceId_idx" ON "service_material_standards"("serviceId");

-- AddForeignKey
ALTER TABLE "service_material_standards" ADD CONSTRAINT "service_material_standards_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

