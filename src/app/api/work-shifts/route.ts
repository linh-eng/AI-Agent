export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { workShiftCreateSchema } from "@/lib/clinic-validation";
import { parseVnLocal, vnClock } from "@/lib/timezone";

// GET /api/work-shifts?employeeId=&branchId=&from=&to=&status=  (org: attendance.read)
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const p = new URL(req.url).searchParams;
  const employeeId = p.get("employeeId") ?? undefined;
  const branchId = p.get("branchId") ?? undefined;
  const status = p.get("status") ?? undefined;
  const from = p.get("from");
  const to = p.get("to");
  const shifts = await prisma.workShift.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(from || to ? { workDate: { ...(from ? { gte: parseVnLocal(from) } : {}), ...(to ? { lte: parseVnLocal(to) } : {}) } } : {}),
    },
    include: { employee: { select: { code: true, fullName: true } }, branch: { select: { name: true } } },
    orderBy: [{ workDate: "asc" }, { scheduledStartAt: "asc" }],
    take: 1000,
  });
  return ok(shifts);
});

// POST /api/work-shifts  → tạo ca tay (attendance.write). Thời gian nhập giờ VN.
export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const session = await getSession();
  const input = workShiftCreateSchema.parse(await req.json());
  const start = parseVnLocal(input.scheduledStartAt);
  const end = parseVnLocal(input.scheduledEndAt);
  if (end.getTime() <= start.getTime()) return fail(422, "Giờ kết thúc phải sau giờ bắt đầu");
  const emp = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { id: true, branchId: true } });
  if (!emp) return fail(404, "Không tìm thấy nhân sự");
  const c = vnClock(start);
  const workDate = parseVnLocal(`${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`);
  const shift = await prisma.workShift.create({
    data: {
      employeeId: input.employeeId, branchId: input.branchId ?? emp.branchId ?? null, workDate,
      scheduledStartAt: start, scheduledEndAt: end, breakMinutes: input.breakMinutes ?? 0,
      shiftLabel: input.shiftLabel ?? null, roleSnapshot: input.roleSnapshot ?? null,
      source: "MANUAL", status: "SCHEDULED", note: input.note ?? null, createdBy: session?.name ?? null,
    },
  });
  await auditLog({ userId: session?.userId, action: "WORK_SHIFT_CREATED", entityType: "WorkShift", entityId: shift.id, changes: { employeeId: input.employeeId, workDate: workDate.toISOString() } });
  return created(shift);
});
