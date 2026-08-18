-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkShiftStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('OPEN', 'COMPLETED', 'ADJUSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('APP', 'MANUAL', 'DEVICE');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('REQUESTED', 'APPLIED', 'REJECTED');

-- AlterTable
ALTER TABLE "employee_leaves" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedBy" TEXT,
ADD COLUMN     "status" "LeaveStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT,
    "scheduleId" TEXT,
    "workDate" DATE NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "shiftLabel" TEXT,
    "roleSnapshot" TEXT,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "status" "WorkShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workShiftId" TEXT,
    "branchId" TEXT,
    "workDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "breakMinutesActual" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER,
    "scheduledMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "lateMinutes" INTEGER,
    "earlyLeaveMinutes" INTEGER,
    "source" "AttendanceSource" NOT NULL DEFAULT 'APP',
    "status" "AttendanceStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "voidReason" TEXT,
    "voidedBy" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_adjustments" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT,
    "changedBy" TEXT,
    "approvedBy" TEXT,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_shifts_employeeId_workDate_idx" ON "work_shifts"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "work_shifts_branchId_workDate_idx" ON "work_shifts"("branchId", "workDate");

-- CreateIndex
CREATE INDEX "work_shifts_status_idx" ON "work_shifts"("status");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_workDate_idx" ON "attendance_records"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_records_branchId_workDate_idx" ON "attendance_records"("branchId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_adjustments_attendanceRecordId_idx" ON "attendance_adjustments"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "employee_leaves_status_idx" ON "employee_leaves"("status");

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "employee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- HR-PH2 — Ràng buộc CHỐNG ĐUA (concurrency), thuần additive (CREATE INDEX).
-- =============================================================================
-- (1) Mỗi nhân sự chỉ có TỐI ĐA 1 bản ghi chấm công OPEN tại một thời điểm.
--     Hai lần check-in đồng thời → cái thứ 2 vi phạm unique → 409 (không double-open).
CREATE UNIQUE INDEX "attendance_one_open_per_employee"
  ON "attendance_records" ("employeeId") WHERE "status" = 'OPEN';

-- (2) Sinh ca từ mẫu là IDEMPOTENT: 1 ca/ (nhân sự, ngày, mẫu). Ca tạo tay (scheduleId
--     NULL) KHÔNG bị ràng buộc (cho phép nhiều ca/ngày). Chạy generate lại không trùng.
CREATE UNIQUE INDEX "workshift_generated_unique"
  ON "work_shifts" ("employeeId", "workDate", "scheduleId") WHERE "scheduleId" IS NOT NULL;
