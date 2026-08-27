export const dynamic = "force-dynamic";

import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getNxtReport } from "@/lib/reports";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.REPORT_READ);
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const warehouseId = url.searchParams.get("warehouseId");
  if (!fromStr || !toStr) return fail(400, "Thiếu tham số from/to");

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()))
    return fail(400, "Ngày không hợp lệ");

  const rows = await getNxtReport(from, to, warehouseId);
  return ok(rows);
});
