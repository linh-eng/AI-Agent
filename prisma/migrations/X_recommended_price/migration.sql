-- CreateTable
CREATE TABLE "service_recommended_price_versions" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceCostingVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostingStatus" NOT NULL DEFAULT 'DRAFT',
    "targetMarginPercent" DECIMAL(6,2) NOT NULL,
    "costSnapshot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roundingUnit" INTEGER NOT NULL DEFAULT 1000,
    "calculatedRecommendedPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "floorVersionId" TEXT,
    "floorPriceSnapshot" DECIMAL(18,2),
    "note" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,

    CONSTRAINT "service_recommended_price_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_recommended_price_versions_serviceId_status_idx" ON "service_recommended_price_versions"("serviceId", "status");

-- CreateIndex
CREATE INDEX "service_recommended_price_versions_serviceCostingVersionId_idx" ON "service_recommended_price_versions"("serviceCostingVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "service_recommended_price_versions_serviceId_version_key" ON "service_recommended_price_versions"("serviceId", "version");

-- AddForeignKey
ALTER TABLE "service_recommended_price_versions" ADD CONSTRAINT "service_recommended_price_versions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_recommended_price_versions" ADD CONSTRAINT "service_recommended_price_versions_serviceCostingVersionId_fkey" FOREIGN KEY ("serviceCostingVersionId") REFERENCES "service_costing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

