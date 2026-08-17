-- CreateEnum
CREATE TYPE "ProtocolCompositionMode" AS ENUM ('LEGACY_STEPS', 'SERVICES');

-- AlterTable
ALTER TABLE "brand_protocols" ADD COLUMN     "compositionMode" "ProtocolCompositionMode" NOT NULL DEFAULT 'LEGACY_STEPS';

-- CreateTable
CREATE TABLE "protocol_services" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "conditionText" TEXT,
    "notes" TEXT,
    "durationOverride" INTEGER,
    "serviceVersionSnapshot" INTEGER,
    "recommendedVariants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocol_services_protocolId_sortOrder_idx" ON "protocol_services"("protocolId", "sortOrder");

-- CreateIndex
CREATE INDEX "protocol_services_serviceId_idx" ON "protocol_services"("serviceId");

-- AddForeignKey
ALTER TABLE "protocol_services" ADD CONSTRAINT "protocol_services_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_services" ADD CONSTRAINT "protocol_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

