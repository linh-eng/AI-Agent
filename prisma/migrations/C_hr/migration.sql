-- CreateEnum
CREATE TYPE "SessionStaffRole" AS ENUM ('PRIMARY', 'ASSISTANT', 'MASTER', 'CHECKER', 'CONSULTANT');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultFee" DECIMAL(18,2),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_staff" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "employeeId" TEXT,
    "staffName" TEXT NOT NULL,
    "role" "SessionStaffRole" NOT NULL DEFAULT 'PRIMARY',
    "fee" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE INDEX "session_staff_sessionId_idx" ON "session_staff"("sessionId");

-- CreateIndex
CREATE INDEX "session_staff_employeeId_idx" ON "session_staff"("employeeId");

-- AddForeignKey
ALTER TABLE "session_staff" ADD CONSTRAINT "session_staff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_staff" ADD CONSTRAINT "session_staff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

