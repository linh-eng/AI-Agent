-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FrequencyUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlanStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "PlanStatus" ADD VALUE 'APPROVED';

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "treatment_plans" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approver" TEXT,
ADD COLUMN     "designer" TEXT,
ADD COLUMN     "plannedEndDate" TIMESTAMP(3),
ADD COLUMN     "plannedStartDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "treatment_stages" ADD COLUMN     "frequencyUnit" "FrequencyUnit",
ADD COLUMN     "frequencyValue" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "plannedEndDate" TIMESTAMP(3),
ADD COLUMN     "plannedSessions" INTEGER,
ADD COLUMN     "plannedStartDate" TIMESTAMP(3),
ADD COLUMN     "status" "StageStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "treatment_sessions" ADD COLUMN     "intervalDays" INTEGER,
ADD COLUMN     "plannedDate" TIMESTAMP(3),
ADD COLUMN     "plannedProtocolId" TEXT,
ADD COLUMN     "plannedServiceId" TEXT,
ADD COLUMN     "plannedStaff" JSONB,
ADD COLUMN     "plannedTechnologyId" TEXT,
ADD COLUMN     "versionAtExecution" INTEGER;

-- CreateTable
CREATE TABLE "treatment_plan_versions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_plan_versions_planId_toVersion_idx" ON "treatment_plan_versions"("planId", "toVersion");

-- AddForeignKey
ALTER TABLE "treatment_plan_versions" ADD CONSTRAINT "treatment_plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

