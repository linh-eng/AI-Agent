-- Zl_service_step_link — ServiceStep có thể LỒNG một dịch vụ khác vào protocol (soft compose).
-- Thuần additive: 1 cột nullable + 1 FK (onDelete SET NULL). 0 lệnh phá hủy.

-- AlterTable
ALTER TABLE "service_steps" ADD COLUMN     "linkedServiceId" TEXT;

-- AddForeignKey
ALTER TABLE "service_steps" ADD CONSTRAINT "service_steps_linkedServiceId_fkey" FOREIGN KEY ("linkedServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
