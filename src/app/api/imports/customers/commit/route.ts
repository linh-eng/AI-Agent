export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { importCustomersSchema } from "@/lib/clinic-validation";
import { commitImport } from "@/lib/import-customers";
import { auditLog } from "@/lib/clinic";

// Ghi import: tạo mới + (tùy chọn) cập nhật khách trùng theo merge rule. Lưu vết
// ImportBatch + audit. Trả BÁO CÁO import (batch, tạo/cập nhật/bỏ qua/lỗi).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const parsed = importCustomersSchema.parse(await req.json());
  const report = await commitImport(parsed.rows, {
    legacySource: parsed.legacySource,
    strategy: parsed.strategy,
    filename: parsed.filename ?? null,
    mapping: parsed.mapping ?? null,
    createdBy: session.name,
  });
  await auditLog({
    userId: session.userId,
    action: "CUSTOMERS_IMPORTED",
    entityType: "ImportBatch",
    entityId: report.batchId,
    changes: { batchCode: report.batchCode, source: parsed.legacySource, strategy: parsed.strategy, created: report.created, updated: report.updated, skipped: report.skippedDuplicate, errors: report.errorRows },
  });
  return ok(report);
});
