-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVERSED');

-- CreateEnum
CREATE TYPE "ContributionEntryKind" AS ENUM ('CONTRIBUTION', 'REVERSAL');

-- CreateTable
CREATE TABLE "staff_contribution_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultWeight" DECIMAL(6,3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_contribution_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_staff_contributions" (
    "id" TEXT NOT NULL,
    "treatmentSessionId" TEXT NOT NULL,
    "sessionExecutionItemId" TEXT,
    "serviceStepKey" TEXT,
    "serviceIdSnapshot" TEXT,
    "serviceNameSnapshot" TEXT,
    "employeeId" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "employeeRoleSnapshot" TEXT,
    "contributionTypeId" TEXT,
    "contributionTypeCode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "weight" DECIMAL(6,3),
    "quantity" DECIMAL(14,3),
    "branchId" TEXT,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "entryKind" "ContributionEntryKind" NOT NULL DEFAULT 'CONTRIBUTION',
    "status" "ContributionStatus" NOT NULL DEFAULT 'DRAFT',
    "crossCheckFlags" JSONB,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "reversalOfId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_staff_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_contribution_types_code_key" ON "staff_contribution_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "session_staff_contributions_idempotencyKey_key" ON "session_staff_contributions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "session_staff_contributions_treatmentSessionId_idx" ON "session_staff_contributions"("treatmentSessionId");

-- CreateIndex
CREATE INDEX "session_staff_contributions_sessionExecutionItemId_idx" ON "session_staff_contributions"("sessionExecutionItemId");

-- CreateIndex
CREATE INDEX "session_staff_contributions_employeeId_idx" ON "session_staff_contributions"("employeeId");

-- CreateIndex
CREATE INDEX "session_staff_contributions_status_idx" ON "session_staff_contributions"("status");

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_treatmentSessionId_fkey" FOREIGN KEY ("treatmentSessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_sessionExecutionItemId_fkey" FOREIGN KEY ("sessionExecutionItemId") REFERENCES "session_execution_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_contributionTypeId_fkey" FOREIGN KEY ("contributionTypeId") REFERENCES "staff_contribution_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff_contributions" ADD CONSTRAINT "session_staff_contributions_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "session_staff_contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

