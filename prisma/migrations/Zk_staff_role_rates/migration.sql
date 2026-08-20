-- ② Chi phí nhân sự theo vai trò: bảng đơn giá vai trò + dòng chi phí nhân sự trong Giá vốn.
-- Thuần ADDITIVE (0 DROP): thêm 1 cột JSON nullable + 1 bảng catalog mới.

ALTER TABLE "service_costing_versions" ADD COLUMN "laborCostLines" JSONB;

CREATE TABLE "staff_role_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "baseFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tips" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commissionPercent" DECIMAL(6,2),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_role_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_role_rates_code_key" ON "staff_role_rates"("code");
CREATE INDEX "staff_role_rates_isActive_idx" ON "staff_role_rates"("isActive");
