export const dynamic = "force-dynamic";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { approvePayrollPeriod } from "@/lib/payroll";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PAYROLL_APPROVE);
  const res = await approvePayrollPeriod(session, params.id);
  return ok(res ?? { ok: true });
});
