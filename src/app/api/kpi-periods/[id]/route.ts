export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { kpiPeriodUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// GET — chi tiết kỳ + snapshot CURRENT (kèm định nghĩa + nhân sự).
export const GET = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const period = await prisma.kpiPeriod.findUnique({
    where: { id: params.id },
    include: { branch: { select: { code: true, name: true } } },
  });
  if (!period) return fail(404, "Không tìm thấy kỳ KPI");
  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: { kpiPeriodId: params.id, status: "CURRENT" },
    include: {
      employee: { select: { code: true, fullName: true, branchId: true } },
      definition: { select: { code: true, name: true, unit: true, category: true, direction: true } },
    },
    orderBy: [{ employeeId: "asc" }],
  });
  return ok({ period, snapshots });
});

// PATCH — sửa tên/ghi chú/trạng thái (không tự đặt LOCKED ở đây — dùng /lock).
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const patch = kpiPeriodUpdateSchema.parse(await req.json());
  const period = await prisma.kpiPeriod.findUnique({ where: { id: params.id } });
  if (!period) return fail(404, "Không tìm thấy kỳ KPI");
  if (period.status === "LOCKED") return fail(409, "Kỳ đã KHÓA — không thể sửa");
  if (patch.status === "LOCKED") return fail(400, "Dùng thao tác Khóa kỳ (/lock) để khóa");
  const rec = await prisma.kpiPeriod.update({ where: { id: params.id }, data: { name: patch.name ?? undefined, note: patch.note ?? undefined, status: patch.status ?? undefined } });
  await auditLog({ userId: session.userId, action: "KPI_PERIOD_UPDATED", entityType: "KpiPeriod", entityId: rec.id, changes: { fields: Object.keys(patch) } });
  return ok(rec);
});
