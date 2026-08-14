-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED');

-- CreateEnum
CREATE TYPE "CompetenceKind" AS ENUM ('TECHNOLOGY', 'SERVICE', 'PROTOCOL', 'ROLE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'EMERGENCY', 'UNAVAILABLE', 'OTHER');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "branch" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "employee_role_fees" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_role_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_competences" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "CompetenceKind" NOT NULL,
    "refId" TEXT,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_competences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "mediaId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedules" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "shift" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leaves" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_role_fees_employeeId_role_idx" ON "employee_role_fees"("employeeId", "role");

-- CreateIndex
CREATE INDEX "employee_competences_employeeId_idx" ON "employee_competences"("employeeId");

-- CreateIndex
CREATE INDEX "employee_competences_kind_refId_idx" ON "employee_competences"("kind", "refId");

-- CreateIndex
CREATE INDEX "employee_certifications_employeeId_idx" ON "employee_certifications"("employeeId");

-- CreateIndex
CREATE INDEX "employee_schedules_employeeId_idx" ON "employee_schedules"("employeeId");

-- CreateIndex
CREATE INDEX "employee_leaves_employeeId_fromAt_idx" ON "employee_leaves"("employeeId", "fromAt");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- AddForeignKey
ALTER TABLE "employee_role_fees" ADD CONSTRAINT "employee_role_fees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competences" ADD CONSTRAINT "employee_competences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certifications" ADD CONSTRAINT "employee_certifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

