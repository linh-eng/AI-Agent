export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, fail, handle } from "@/lib/api";
import { requireAuth, requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { baseSalaryCreateSchema } from "@/lib/clinic-validation";
import { isSelfEmployee } from "@/lib/hr-self";
import { auditLog } from "@/lib/clinic";

// GET — payroll.read (org) HOẶC chính chủ (self FK). Lương cơ bản là dữ liệu riêng tư.
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const p = new URL(req.url).searchParams;
  const employeeId = p.get("employeeId") ?? undefined;
  const canRead = session.permissions.includes(PERMISSIONS.PAYROLL_READ);
  if (!canRead) {
    if (!employeeId || !(await isSelfEmployee(session, employeeId))) return fail(403, "Không có quyền xem lương cơ bản");
  }
  const rows = await prisma.employeeBaseSalary.findMany({ where: { ...(employeeId ? { employeeId } : {}) }, orderBy: [{ effectiveFrom: "desc" }] });
  return ok(rows);
});

// POST — payroll.write (append-only versioned).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PAYROLL_WRITE);
  const input = baseSalaryCreateSchema.parse(await req.json());
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true } });
  if (!emp) return fail(422, "Nhân sự không tồn tại");
  const rec = await prisma.employeeBaseSalary.create({ data: {
    employeeId: input.employeeId, amount: input.amount as any,
    effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`), effectiveTo: input.effectiveTo ? new Date(`${input.effectiveTo}T00:00:00.000Z`) : null,
    note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
  } });
  await auditLog({ userId: session.userId, action: "PAYROLL_BASE_SALARY_SET", entityType: "EmployeeBaseSalary", entityId: rec.id, changes: { employeeId: input.employeeId } });
  return created(rec);
});
