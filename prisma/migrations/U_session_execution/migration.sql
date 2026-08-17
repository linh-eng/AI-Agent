-- CreateEnum
CREATE TYPE "ExecutionOptionSource" AS ENUM ('SERVICE_SOP_OPTION', 'PROTOCOL_VARIANT', 'PRACTITIONER_ADHOC');

-- CreateEnum
CREATE TYPE "MaterialUsageType" AS ENUM ('CONSUMPTION', 'REVERSAL', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "treatment_sessions" ADD COLUMN     "executionFrozenAt" TIMESTAMP(3),
ADD COLUMN     "executionSnapshot" JSONB,
ALTER COLUMN "planId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "material_usages" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "reversalOfUsageId" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedBy" TEXT,
ADD COLUMN     "usageType" "MaterialUsageType" NOT NULL DEFAULT 'CONSUMPTION';

-- CreateTable
CREATE TABLE "session_execution_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "bookingItemId" TEXT,
    "serviceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "selectedOptionSource" "ExecutionOptionSource" NOT NULL DEFAULT 'PRACTITIONER_ADHOC',
    "selectedOptionId" TEXT,
    "selectedOptionName" TEXT,
    "sourceVersion" INTEGER,
    "executionSnapshot" JSONB,
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_execution_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_execution_items_sessionId_sortOrder_idx" ON "session_execution_items"("sessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "session_execution_items_serviceId_idx" ON "session_execution_items"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "material_usages_idempotencyKey_key" ON "material_usages"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "session_execution_items" ADD CONSTRAINT "session_execution_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_execution_items" ADD CONSTRAINT "session_execution_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_execution_items" ADD CONSTRAINT "session_execution_items_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "booking_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_reversalOfUsageId_fkey" FOREIGN KEY ("reversalOfUsageId") REFERENCES "material_usages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

