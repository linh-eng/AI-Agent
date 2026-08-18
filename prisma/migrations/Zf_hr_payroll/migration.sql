-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'LOCKED');

-- CreateEnum
CREATE TYPE "PayrollComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollCalcType" AS ENUM ('FIXED', 'PERCENT_BASE', 'PERCENT_GROSS');

-- CreateEnum
CREATE TYPE "PayrollLineStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "employee_base_salaries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_base_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_component_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PayrollComponentKind" NOT NULL,
    "calcType" "PayrollCalcType" NOT NULL DEFAULT 'FIXED',
    "value" DECIMAL(18,4) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'COMPANY',
    "scopeRef" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_component_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "branchId" TEXT,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMP(3),
    "calculatedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payroll_lines" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earningsCommission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earningsIncentive" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earningsBonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "earningsAdjustment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allowanceTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL,
    "employeeSnapshot" TEXT,
    "branchSnapshot" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PayrollLineStatus" NOT NULL DEFAULT 'CURRENT',
    "lockedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_base_salaries_employeeId_effectiveFrom_idx" ON "employee_base_salaries"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_component_rules_code_key" ON "payroll_component_rules"("code");

-- CreateIndex
CREATE INDEX "payroll_component_rules_kind_idx" ON "payroll_component_rules"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_code_key" ON "payroll_periods"("code");

-- CreateIndex
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");

-- CreateIndex
CREATE INDEX "employee_payroll_lines_payrollPeriodId_idx" ON "employee_payroll_lines"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "employee_payroll_lines_employeeId_idx" ON "employee_payroll_lines"("employeeId");

-- CreateIndex
CREATE INDEX "employee_payroll_lines_status_idx" ON "employee_payroll_lines"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_payroll_lines_payrollPeriodId_employeeId_version_key" ON "employee_payroll_lines"("payrollPeriodId", "employeeId", "version");

-- AddForeignKey
ALTER TABLE "employee_base_salaries" ADD CONSTRAINT "employee_base_salaries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_lines" ADD CONSTRAINT "employee_payroll_lines_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payroll_lines" ADD CONSTRAINT "employee_payroll_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

