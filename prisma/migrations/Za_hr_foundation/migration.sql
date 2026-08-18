-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY', 'CONTRACT', 'OTHER');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "employmentType" "EmploymentType",
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_branchId_idx" ON "employees"("branchId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- HR-PH1 BACKFILL (additive, deterministic, KHÔNG phá hủy)
-- Chuẩn hóa Employee.branch (String) hiện có → Branch master + gán branchId.
-- Nguyên tắc: KHÔNG merge tên khác nhau; mỗi giá trị trimmed KHÁC NHAU = 1 Branch
-- riêng (kể cả khác hoa/thường) để tránh gộp nhầm hai cơ sở khác nhau.
-- Employee.branch (String) legacy GIỮ NGUYÊN (không xóa cột).
-- =============================================================================

-- 1) Tạo Branch cho mỗi giá trị branch trimmed, không rỗng, phân biệt (case-sensitive).
INSERT INTO "branches" ("id", "code", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       'CN-' || LPAD((ROW_NUMBER() OVER (ORDER BY b))::text, 4, '0'),
       b,
       true,
       now(),
       now()
FROM (
  SELECT DISTINCT TRIM("branch") AS b
  FROM "employees"
  WHERE "branch" IS NOT NULL AND TRIM("branch") <> ''
) d;

-- 2) Gán branchId theo khớp CHÍNH XÁC tên (trimmed) — 1-1, không đoán, không gộp.
UPDATE "employees" e
SET "branchId" = br."id"
FROM "branches" br
WHERE e."branch" IS NOT NULL
  AND TRIM(e."branch") = br."name"
  AND e."branchId" IS NULL;
