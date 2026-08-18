export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { payrollPeriodCreateSchema } from "@/lib/clinic-validation";
import { nextPayrollCode } from "@/lib/payroll";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PAYROLL_READ);
  const rows = await prisma.payrollPeriod.findMany({ orderBy: [{ startDate: "desc" }], include: { _count: { select: { lines: true } } }, take: 500 });
  return ok(rows);
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PAYROLL_WRITE);
  const input = payrollPeriodCreateSchema.parse(await req.json());
  const code = await nextPayrollCode();
  const rec = await prisma.payrollPeriod.create({ data: {
    code, name: input.name, periodType: input.periodType ?? "MONTHLY",
    startDate: new Date(`${input.startDate}T00:00:00.000Z`), endDate: new Date(`${input.endDate}T00:00:00.000Z`),
    branchId: input.branchId ?? null, note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
  } });
  await auditLog({ userId: session.userId, action: "PAYROLL_PERIOD_CREATED", entityType: "PayrollPeriod", entityId: rec.id, changes: { code } });
  return created(rec);
});
