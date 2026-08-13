export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { importCustomersSchema } from "@/lib/clinic-validation";
import { commitImport } from "@/lib/import-customers";
import { auditLog } from "@/lib/clinic";

// Ghi các dòng NEW (bỏ qua trùng & lỗi). Trả BÁO CÁO import.
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const parsed = importCustomersSchema.parse(await req.json());
  const report = await commitImport(parsed.rows, parsed.legacySource, session.name);
  await auditLog({
    userId: session.userId,
    action: "CUSTOMERS_IMPORTED",
    entityType: "Customer",
    entityId: "import",
    changes: { source: parsed.legacySource, created: report.created, skipped: report.skippedDuplicate, errors: report.errorRows },
  });
  return ok(report);
});
