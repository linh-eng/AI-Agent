export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiPeriodCreateSchema } from "@/lib/clinic-validation";
import { nextKpiPeriodCode } from "@/lib/kpi";
import { auditLog } from "@/lib/clinic";

// GET — danh sách kỳ KPI (attendance.read — cấp tổ chức, managerial).
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const rows = await prisma.kpiPeriod.findMany({
    orderBy: [{ startDate: "desc" }],
    include: { branch: { select: { code: true, name: true } }, _count: { select: { snapshots: true } } },
    take: 500,
  });
  return ok(rows);
});

// POST — tạo kỳ (attendance.write).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const input = kpiPeriodCreateSchema.parse(await req.json());
  if (input.branchId) {
    const b = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
    if (!b) return fail(422, "Chi nhánh không tồn tại");
  }
  const code = await nextKpiPeriodCode();
  const rec = await prisma.kpiPeriod.create({
    data: {
      code, name: input.name, periodType: input.periodType ?? "MONTHLY",
      startDate: new Date(`${input.startDate}T00:00:00.000Z`), endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      branchId: input.branchId ?? null, note: input.note ?? null, createdBy: session.name ?? session.email ?? null,
    },
  });
  await auditLog({ userId: session.userId, action: "KPI_PERIOD_CREATED", entityType: "KpiPeriod", entityId: rec.id, changes: { code, startDate: input.startDate, endDate: input.endDate, branchId: input.branchId ?? null } });
  return created(rec);
});
