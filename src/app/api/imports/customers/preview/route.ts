export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { importCustomersSchema } from "@/lib/clinic-validation";
import { analyzeImportRows } from "@/lib/import-customers";

// Dry-run: chuẩn hóa + validate + phát hiện trùng — KHÔNG ghi dữ liệu.
export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.CUSTOMER_WRITE);
  const parsed = importCustomersSchema.parse(await req.json());
  const analysis = await analyzeImportRows(parsed.rows, parsed.legacySource, parsed.strategy);
  const summary = {
    total: analysis.length,
    new: analysis.filter((a) => a.status === "NEW").length,
    duplicate: analysis.filter((a) => a.status === "DUPLICATE").length,
    error: analysis.filter((a) => a.status === "ERROR").length,
    // hành động dự kiến theo chiến lược (mục 12 VII)
    willCreate: analysis.filter((a) => a.action === "CREATE").length,
    willUpdate: analysis.filter((a) => a.action === "UPDATE").length,
    willSkip: analysis.filter((a) => a.action === "SKIP").length,
  };
  return ok({ summary, analysis });
});
