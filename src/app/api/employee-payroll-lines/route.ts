export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { resolveSelfEmployeeId } from "@/lib/hr-self";

// GET — phiếu lương. payroll.read → tổ chức (lọc). Không có → CHỈ của chính mình
// (self FK). Payroll là dữ liệu RIÊNG TƯ — finance.read KHÔNG cấp quyền.
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const canRead = session.permissions.includes(PERMISSIONS.PAYROLL_READ);
  const p = new URL(req.url).searchParams;
  const where: any = { status: "CURRENT" };
  if (p.get("payrollPeriodId")) where.payrollPeriodId = p.get("payrollPeriodId");
  if (canRead) {
    if (p.get("employeeId")) where.employeeId = p.get("employeeId");
  } else {
    const selfId = await resolveSelfEmployeeId(session);
    if (!selfId) return fail(403, "Không có quyền xem bảng lương");
    where.employeeId = selfId;
  }
  const rows = await prisma.employeePayrollLine.findMany({ where, include: { employee: { select: { code: true, fullName: true } }, period: { select: { code: true, name: true, status: true, startDate: true, endDate: true } } }, orderBy: [{ createdAt: "desc" }], take: 2000 });
  return ok(rows);
});
