-- Chi phí phát sinh (nút "+") cho Giá vốn dịch vụ — additive, nullable JSON.
ALTER TABLE "service_costing_versions" ADD COLUMN "extraCostLines" JSONB;
