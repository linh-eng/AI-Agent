-- CreateTable
CREATE TABLE "service_price_floors" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "laborCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "operationCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depreciationCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roomCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minMarginPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_price_floors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_price_floors_serviceId_key" ON "service_price_floors"("serviceId");

-- AddForeignKey
ALTER TABLE "service_price_floors" ADD CONSTRAINT "service_price_floors_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

