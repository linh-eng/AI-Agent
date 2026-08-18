export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

export const GET = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.PAYROLL_READ);
  const period = await prisma.payrollPeriod.findUnique({ where: { id: params.id } });
  if (!period) return fail(404, "Không tìm thấy kỳ lương");
  const lines = await prisma.employeePayrollLine.findMany({
    where: { payrollPeriodId: params.id, status: "CURRENT" },
    include: { employee: { select: { code: true, fullName: true } } },
    orderBy: [{ employeeId: "asc" }],
  });
  return ok({ period, lines });
});
