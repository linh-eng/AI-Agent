-- CreateEnum
CREATE TYPE "FloorCostSource" AS ENUM ('COSTING_VERSION', 'LEGACY_LINES');

-- AlterTable
ALTER TABLE "service_price_floor_versions" ADD COLUMN     "costSource" "FloorCostSource" NOT NULL DEFAULT 'LEGACY_LINES',
ADD COLUMN     "serviceCostingVersionId" TEXT;

-- CreateIndex
CREATE INDEX "service_price_floor_versions_serviceCostingVersionId_idx" ON "service_price_floor_versions"("serviceCostingVersionId");

-- AddForeignKey
ALTER TABLE "service_price_floor_versions" ADD CONSTRAINT "service_price_floor_versions_serviceCostingVersionId_fkey" FOREIGN KEY ("serviceCostingVersionId") REFERENCES "service_costing_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

