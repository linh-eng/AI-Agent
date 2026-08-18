export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { calculatePayrollPeriod } from "@/lib/payroll";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PAYROLL_WRITE);
  const res = await calculatePayrollPeriod(session, params.id);
  return ok(res ?? { ok: true });
});
