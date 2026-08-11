-- CreateEnum
CREATE TYPE "MaterialMovementType" AS ENUM ('REQUEST', 'RESERVE', 'ISSUE', 'CONSUME', 'RETURN', 'WASTE', 'DAMAGE');

-- AlterTable
ALTER TABLE "treatment_sessions" ADD COLUMN     "materialCost" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "session_materials" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spaProductId" TEXT,
    "inventoryProductId" TEXT,
    "warehouseId" TEXT,
    "uom" TEXT,
    "isProfessional" BOOLEAN NOT NULL DEFAULT false,
    "plannedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "issuedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "consumedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "wasteQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,2),
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_movements" (
    "id" TEXT NOT NULL,
    "sessionMaterialId" TEXT NOT NULL,
    "type" "MaterialMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(18,2),
    "warehouseId" TEXT,
    "bookingId" TEXT,
    "customerId" TEXT,
    "staff" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_materials_sessionId_idx" ON "session_materials"("sessionId");

-- CreateIndex
CREATE INDEX "material_movements_sessionMaterialId_idx" ON "material_movements"("sessionMaterialId");

-- AddForeignKey
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_spaProductId_fkey" FOREIGN KEY ("spaProductId") REFERENCES "spa_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_sessionMaterialId_fkey" FOREIGN KEY ("sessionMaterialId") REFERENCES "session_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

