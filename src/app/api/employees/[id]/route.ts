export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { employeeUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance, auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.HR_READ);
  const session = await getSession();
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return fail(404, "Không tìm thấy nhân sự");
  return ok(maskFinance(employee, canSeeFinance(session), ["defaultFee"]));
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.HR_WRITE);
  const parsed = employeeUpdateSchema.parse(await req.json());
  const data: Record<string, unknown> = {};
  if (parsed.fullName !== undefined) data.fullName = parsed.fullName;
  if (parsed.phone !== undefined) data.phone = parsed.phone;
  if (parsed.email !== undefined) data.email = parsed.email || null;
  if (parsed.roles !== undefined) data.roles = parsed.roles;
  if (parsed.defaultFee !== undefined) data.defaultFee = parsed.defaultFee;
  if (parsed.note !== undefined) data.note = parsed.note;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: "EMPLOYEE_UPDATED",
    entityType: "Employee",
    entityId: employee.id,
    changes: { isActive: employee.isActive },
  });
  return ok(employee);
});
