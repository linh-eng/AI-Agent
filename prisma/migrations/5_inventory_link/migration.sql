-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "reservedQty" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "session_materials" ADD COLUMN     "lotId" TEXT;

-- AlterTable
ALTER TABLE "material_movements" ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "stockMovementId" TEXT;

-- CreateIndex
CREATE INDEX "session_materials_lotId_idx" ON "session_materials"("lotId");

-- AddForeignKey
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

