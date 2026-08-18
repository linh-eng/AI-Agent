export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { parseVnLocal } from "@/lib/timezone";
import { deriveFlags } from "@/lib/attendance";

// GET /api/attendance?employeeId=&branchId=&from=&to=&status= — org (attendance.read).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const p = new URL(req.url).searchParams;
  const employeeId = p.get("employeeId") ?? undefined;
  const branchId = p.get("branchId") ?? undefined;
  const status = p.get("status") ?? undefined;
  const from = p.get("from"); const to = p.get("to");
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(from || to ? { workDate: { ...(from ? { gte: parseVnLocal(from) } : {}), ...(to ? { lte: parseVnLocal(to) } : {}) } } : {}),
    },
    include: { employee: { select: { code: true, fullName: true } }, branch: { select: { name: true } } },
    orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
    take: 1000,
  });
  return ok(rows.map((r) => ({ ...r, flags: deriveFlags(r as any) })));
});
