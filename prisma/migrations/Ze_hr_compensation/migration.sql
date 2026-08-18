-- CreateEnum
CREATE TYPE "CompScopeType" AS ENUM ('COMPANY', 'BRANCH', 'ROLE', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "CompVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CommissionBasisType" AS ENUM ('COLLECTED_CASH', 'INVOICE_NET', 'FIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "CompTargetType" AS ENUM ('ALL', 'SERVICE', 'SERVICE_CATEGORY', 'PROTOCOL_PACKAGE', 'BRAND', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "IncentiveBasisType" AS ENUM ('FIXED_PER_SERVICE', 'FIXED_PER_CONTRIBUTION', 'PER_MINUTE', 'PERCENT_ALLOCATED_REVENUE');

-- CreateEnum
CREATE TYPE "IncentiveWeightMode" AS ENUM ('IGNORE_WEIGHT', 'APPLY_CONTRIBUTION_WEIGHT');

-- CreateEnum
CREATE TYPE "KpiBonusComparator" AS ENUM ('GTE', 'GT', 'LTE', 'LT', 'EQ');

-- CreateEnum
CREATE TYPE "KpiBonusType" AS ENUM ('FIXED', 'RATE');

-- CreateEnum
CREATE TYPE "AttributionRole" AS ENUM ('ORIGINATOR', 'BOOKER', 'CONSULTANT', 'CLOSER', 'ACCOUNT_OWNER', 'COLLECTOR');

-- CreateEnum
CREATE TYPE "AttributionStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "CompSourceType" AS ENUM ('CUSTOMER', 'BOOKING', 'PROPOSAL', 'INVOICE', 'PAYMENT', 'DEPOSIT', 'SESSION_CONTRIBUTION', 'KPI_SNAPSHOT');

-- CreateEnum
CREATE TYPE "CompEventType" AS ENUM ('SALES_COMMISSION', 'TREATMENT_INCENTIVE', 'KPI_BONUS', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CompEventStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'REVERSED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "compensation_policies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "CompScopeType" NOT NULL DEFAULT 'COMPANY',
    "branchId" TEXT,
    "roleCode" TEXT,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentVersionId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_policy_versions" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "CompVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSnapshot" JSONB,
    "supersedesId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "compensation_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "basisType" "CommissionBasisType" NOT NULL DEFAULT 'COLLECTED_CASH',
    "targetType" "CompTargetType" NOT NULL DEFAULT 'ALL',
    "targetId" TEXT,
    "ratePercent" DECIMAL(9,4),
    "fixedAmount" DECIMAL(18,2),
    "thresholdMin" DECIMAL(18,2),
    "thresholdMax" DECIMAL(18,2),
    "attributionRole" "AttributionRole",
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_incentive_rules" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceCategoryId" TEXT,
    "contributionTypeCode" TEXT,
    "employeeRoleCode" TEXT,
    "basisType" "IncentiveBasisType" NOT NULL DEFAULT 'FIXED_PER_CONTRIBUTION',
    "fixedAmount" DECIMAL(18,2),
    "perMinuteAmount" DECIMAL(18,2),
    "ratePercent" DECIMAL(9,4),
    "weightMode" "IncentiveWeightMode" NOT NULL DEFAULT 'IGNORE_WEIGHT',
    "minimumMinutes" INTEGER,
    "maxAmount" DECIMAL(18,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "treatment_incentive_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_bonus_rules" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kpiDefinitionId" TEXT NOT NULL,
    "comparator" "KpiBonusComparator" NOT NULL DEFAULT 'GTE',
    "threshold" DECIMAL(18,3) NOT NULL,
    "bonusType" "KpiBonusType" NOT NULL DEFAULT 'FIXED',
    "fixedAmount" DECIMAL(18,2),
    "rate" DECIMAL(9,4),
    "tier" INTEGER NOT NULL DEFAULT 0,
    "requireVerified" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "kpi_bonus_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_attributions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sourceType" "CompSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "attributionRole" "AttributionRole" NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "branchId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeNameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT,
    "sourceSnapshot" JSONB,
    "status" "AttributionStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_events" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "eventType" "CompEventType" NOT NULL,
    "sourceType" "CompSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "basisAmount" DECIMAL(18,2),
    "quantity" DECIMAL(14,3),
    "rate" DECIMAL(9,4),
    "weight" DECIMAL(6,3),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "calculationSnapshot" JSONB NOT NULL,
    "employeeSnapshot" TEXT,
    "branchSnapshot" TEXT,
    "status" "CompEventStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "reversalOfId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_policies_code_key" ON "compensation_policies"("code");

-- CreateIndex
CREATE INDEX "compensation_policies_scopeType_idx" ON "compensation_policies"("scopeType");

-- CreateIndex
CREATE INDEX "compensation_policy_versions_status_idx" ON "compensation_policy_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_policy_versions_policyId_version_key" ON "compensation_policy_versions"("policyId", "version");

-- CreateIndex
CREATE INDEX "commission_rules_policyVersionId_idx" ON "commission_rules"("policyVersionId");

-- CreateIndex
CREATE INDEX "treatment_incentive_rules_policyVersionId_idx" ON "treatment_incentive_rules"("policyVersionId");

-- CreateIndex
CREATE INDEX "kpi_bonus_rules_policyVersionId_idx" ON "kpi_bonus_rules"("policyVersionId");

-- CreateIndex
CREATE INDEX "sales_attributions_sourceType_sourceId_idx" ON "sales_attributions"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "sales_attributions_employeeId_idx" ON "sales_attributions"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_attributions_employeeId_sourceType_sourceId_attributi_key" ON "sales_attributions"("employeeId", "sourceType", "sourceId", "attributionRole");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_events_idempotencyKey_key" ON "compensation_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "compensation_events_employeeId_idx" ON "compensation_events"("employeeId");

-- CreateIndex
CREATE INDEX "compensation_events_eventType_idx" ON "compensation_events"("eventType");

-- CreateIndex
CREATE INDEX "compensation_events_sourceType_sourceId_idx" ON "compensation_events"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "compensation_events_status_idx" ON "compensation_events"("status");

-- AddForeignKey
ALTER TABLE "compensation_policy_versions" ADD CONSTRAINT "compensation_policy_versions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "compensation_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "compensation_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_incentive_rules" ADD CONSTRAINT "treatment_incentive_rules_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "compensation_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_bonus_rules" ADD CONSTRAINT "kpi_bonus_rules_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "compensation_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_attributions" ADD CONSTRAINT "sales_attributions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_events" ADD CONSTRAINT "compensation_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_events" ADD CONSTRAINT "compensation_events_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "compensation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

