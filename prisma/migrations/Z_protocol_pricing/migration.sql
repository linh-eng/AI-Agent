-- CreateTable
CREATE TABLE "protocol_costing_versions" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostingStatus" NOT NULL DEFAULT 'DRAFT',
    "compositionModeSnapshot" TEXT,
    "protocolVersionSnapshot" INTEGER,
    "serviceCostTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "packageSpecificCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "packageSpecificReason" TEXT,
    "totalEstimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceSnapshot" JSONB,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,

    CONSTRAINT "protocol_costing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_floor_price_versions" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "protocolCostingVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostingStatus" NOT NULL DEFAULT 'DRAFT',
    "minMarginPercent" DECIMAL(6,2) NOT NULL,
    "costSnapshot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roundingUnit" INTEGER NOT NULL DEFAULT 1000,
    "floorPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,

    CONSTRAINT "protocol_floor_price_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_recommended_price_versions" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "protocolCostingVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CostingStatus" NOT NULL DEFAULT 'DRAFT',
    "targetMarginPercent" DECIMAL(6,2) NOT NULL,
    "costSnapshot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roundingUnit" INTEGER NOT NULL DEFAULT 1000,
    "calculatedRecommendedPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "floorVersionId" TEXT,
    "floorPriceSnapshot" DECIMAL(18,2),
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersedesId" TEXT,

    CONSTRAINT "protocol_recommended_price_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocol_costing_versions_protocolId_status_idx" ON "protocol_costing_versions"("protocolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_costing_versions_protocolId_version_key" ON "protocol_costing_versions"("protocolId", "version");

-- CreateIndex
CREATE INDEX "protocol_floor_price_versions_protocolId_status_idx" ON "protocol_floor_price_versions"("protocolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_floor_price_versions_protocolId_version_key" ON "protocol_floor_price_versions"("protocolId", "version");

-- CreateIndex
CREATE INDEX "protocol_recommended_price_versions_protocolId_status_idx" ON "protocol_recommended_price_versions"("protocolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_recommended_price_versions_protocolId_version_key" ON "protocol_recommended_price_versions"("protocolId", "version");

-- AddForeignKey
ALTER TABLE "protocol_costing_versions" ADD CONSTRAINT "protocol_costing_versions_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_floor_price_versions" ADD CONSTRAINT "protocol_floor_price_versions_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_floor_price_versions" ADD CONSTRAINT "protocol_floor_price_versions_protocolCostingVersionId_fkey" FOREIGN KEY ("protocolCostingVersionId") REFERENCES "protocol_costing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_recommended_price_versions" ADD CONSTRAINT "protocol_recommended_price_versions_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "brand_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_recommended_price_versions" ADD CONSTRAINT "protocol_recommended_price_versions_protocolCostingVersion_fkey" FOREIGN KEY ("protocolCostingVersionId") REFERENCES "protocol_costing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

