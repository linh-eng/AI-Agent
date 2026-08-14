export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { employeeUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { employeeKpi } from "@/lib/hr";

function canSeeStaffFee(session: { permissions: string[] } | null): boolean {
  return !!session && (canSeeFinance(session as any) || session.permissions.includes(PERMISSIONS.STAFF_FEE_READ));
}

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.STAFF_READ);
  const session = await getSession();
  const e = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      roleFees: { orderBy: [{ role: "asc" }, { effectiveFrom: "desc" }] },
      competences: { orderBy: { createdAt: "asc" } },
      certifications: { orderBy: { issuedAt: "desc" } },
      schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      leaves: { orderBy: { fromAt: "desc" } },
    },
  });
  if (!e) return fail(404, "Không tìm thấy nhân sự");
  const showFee = canSeeStaffFee(session);
  const kpi = await employeeKpi(e.id);
  return ok({
    ...e,
    defaultFee: showFee ? e.defaultFee : null,
    roleFees: e.roleFees.map((r) => ({ ...r, fee: showFee ? Number(r.fee) : null })),
    canSeeFee: showFee,
    kpi,
  });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_WRITE);
  const parsed = employeeUpdateSchema.parse(await req.json());
  const before = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!before) return fail(404, "Không tìm thấy nhân sự");

  const data: Record<string, unknown> = {};
  if (parsed.fullName !== undefined) data.fullName = parsed.fullName;
  if (parsed.phone !== undefined) data.phone = parsed.phone;
  if (parsed.email !== undefined) data.email = parsed.email || null;
  if (parsed.dob !== undefined) data.dob = parsed.dob;
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.branch !== undefined) data.branch = parsed.branch;
  if (parsed.startDate !== undefined) data.startDate = parsed.startDate;
  if (parsed.roles !== undefined) data.roles = parsed.roles;
  if (parsed.defaultFee !== undefined) data.defaultFee = parsed.defaultFee;
  if (parsed.note !== undefined) data.note = parsed.note;
  if (parsed.status !== undefined) { data.status = parsed.status; data.isActive = parsed.status === "ACTIVE"; }
  else if (parsed.isActive !== undefined) { data.isActive = parsed.isActive; data.status = parsed.isActive ? "ACTIVE" : "RESIGNED"; }

  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  const statusChanged = parsed.status !== undefined && parsed.status !== before.status;
  await auditLog({
    userId: session.userId,
    action: statusChanged ? "EMPLOYEE_STATUS_CHANGED" : "EMPLOYEE_UPDATED",
    entityType: "Employee", entityId: employee.id,
    changes: statusChanged ? { from: before.status, to: employee.status } : { fields: Object.keys(data) },
  });
  return ok(employee);
});
