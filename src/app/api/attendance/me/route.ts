export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { resolveSelfEmployee } from "@/lib/hr-self";
import { deriveFlags } from "@/lib/attendance";

// GET /api/attendance/me — self (ownership FK). Trả ca hôm nay + bản OPEN + lịch sử của CHÍNH MÌNH.
export const GET = handle(async () => {
  const session = await requireAuth();
  const emp = await resolveSelfEmployee(session);
  if (!emp) return ok({ linked: false, employee: null, openAttendance: null, upcomingShifts: [], history: [] });
  const [openAttendance, upcomingShifts, history] = await Promise.all([
    prisma.attendanceRecord.findFirst({ where: { employeeId: emp.id, status: "OPEN" }, orderBy: { checkInAt: "desc" } }),
    prisma.workShift.findMany({ where: { employeeId: emp.id, status: "SCHEDULED" }, orderBy: { scheduledStartAt: "asc" }, take: 20 }),
    prisma.attendanceRecord.findMany({ where: { employeeId: emp.id }, orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }], take: 60 }),
  ]);
  return ok({
    linked: true,
    employee: { id: emp.id, code: emp.code, fullName: emp.fullName },
    openAttendance,
    upcomingShifts,
    history: history.map((r) => ({ ...r, flags: deriveFlags(r as any) })),
  });
});
