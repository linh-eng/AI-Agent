export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

// GET — snapshot KPI. attendance.read → toàn tổ chức (lọc). Không có → CHỈ của
// chính mình (self FK). Không quyền + chưa liên kết → 403. KPI value KHÔNG phải
// payroll-private (không mask) — nhưng cross-employee cần quyền managerial.
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const canRead = session.permissions.includes(PERMISSIONS.ATTENDANCE_READ);
  const p = new URL(req.url).searchParams;
  const where: any = { status: "CURRENT" };
  if (p.get("kpiPeriodId")) where.kpiPeriodId = p.get("kpiPeriodId");
  if (p.get("kpiCode")) where.definition = { code: p.get("kpiCode") };
  if (p.get("kpiDefinitionId")) where.kpiDefinitionId = p.get("kpiDefinitionId");

  if (canRead) {
    if (p.get("employeeId")) where.employeeId = p.get("employeeId");
    if (p.get("branchId")) where.branchSnapshot = p.get("branchId");
  } else {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId) return fail(403, "Không có quyền xem KPI");
    where.employeeId = selfId; // scope cứng theo self — không tin client
  }

  const rows = await prisma.employeeKpiSnapshot.findMany({
    where,
    include: {
      employee: { select: { code: true, fullName: true } },
      definition: { select: { code: true, name: true, unit: true, category: true, direction: true } },
      period: { select: { code: true, name: true, startDate: true, endDate: true, status: true } },
    },
    orderBy: [{ calculatedAt: "desc" }],
    take: 2000,
  });
  return ok(rows);
});
