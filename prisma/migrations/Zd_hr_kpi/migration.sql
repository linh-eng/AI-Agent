-- CreateEnum
CREATE TYPE "KpiCategory" AS ENUM ('PRODUCTIVITY', 'QUALITY', 'ATTENDANCE', 'CUSTOMER', 'SALES', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "KpiCalculationType" AS ENUM ('COUNT_DISTINCT', 'SUM', 'AVERAGE', 'RATIO', 'COUNT');

-- CreateEnum
CREATE TYPE "KpiSourceType" AS ENUM ('CONTRIBUTION', 'ATTENDANCE', 'SESSION', 'REVIEW', 'LEAVE', 'MANUAL');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "KpiPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'LOCKED');

-- CreateEnum
CREATE TYPE "KpiSourceQuality" AS ENUM ('VERIFIED', 'PARTIAL', 'LEGACY_NAME_MATCH', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "KpiSnapshotStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "session_reviews" ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "KpiCategory" NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "calculationType" "KpiCalculationType" NOT NULL DEFAULT 'SUM',
    "sourceType" "KpiSourceType" NOT NULL DEFAULT 'CONTRIBUTION',
    "direction" "KpiDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_periods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "branchId" TEXT,
    "status" "KpiPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "calculatedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_kpi_snapshots" (
    "id" TEXT NOT NULL,
    "kpiPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kpiDefinitionId" TEXT NOT NULL,
    "value" DECIMAL(18,3) NOT NULL,
    "numerator" DECIMAL(18,3),
    "denominator" DECIMAL(18,3),
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "calculationSnapshot" JSONB,
    "sourceQuality" "KpiSourceQuality" NOT NULL DEFAULT 'VERIFIED',
    "branchSnapshot" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "KpiSnapshotStatus" NOT NULL DEFAULT 'CURRENT',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "employee_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_targets" (
    "id" TEXT NOT NULL,
    "kpiDefinitionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'COMPANY',
    "scopeRef" TEXT,
    "targetValue" DECIMAL(18,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_code_key" ON "kpi_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_periods_code_key" ON "kpi_periods"("code");

-- CreateIndex
CREATE INDEX "kpi_periods_status_idx" ON "kpi_periods"("status");

-- CreateIndex
CREATE INDEX "employee_kpi_snapshots_kpiPeriodId_employeeId_idx" ON "employee_kpi_snapshots"("kpiPeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "employee_kpi_snapshots_employeeId_kpiDefinitionId_idx" ON "employee_kpi_snapshots"("employeeId", "kpiDefinitionId");

-- CreateIndex
CREATE INDEX "employee_kpi_snapshots_status_idx" ON "employee_kpi_snapshots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_kpi_snapshots_kpiPeriodId_employeeId_kpiDefinition_key" ON "employee_kpi_snapshots"("kpiPeriodId", "employeeId", "kpiDefinitionId", "version");

-- CreateIndex
CREATE INDEX "kpi_targets_kpiDefinitionId_idx" ON "kpi_targets"("kpiDefinitionId");

-- CreateIndex
CREATE INDEX "session_reviews_employeeId_idx" ON "session_reviews"("employeeId");

-- AddForeignKey
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_periods" ADD CONSTRAINT "kpi_periods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_kpi_snapshots" ADD CONSTRAINT "employee_kpi_snapshots_kpiPeriodId_fkey" FOREIGN KEY ("kpiPeriodId") REFERENCES "kpi_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_kpi_snapshots" ADD CONSTRAINT "employee_kpi_snapshots_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_kpi_snapshots" ADD CONSTRAINT "employee_kpi_snapshots_kpiDefinitionId_fkey" FOREIGN KEY ("kpiDefinitionId") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_kpiDefinitionId_fkey" FOREIGN KEY ("kpiDefinitionId") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

