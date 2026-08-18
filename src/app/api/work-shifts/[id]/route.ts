export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { workShiftUpdateSchema } from "@/lib/clinic-validation";
import { parseVnLocal } from "@/lib/timezone";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);
  const s = await prisma.workShift.findUnique({
    where: { id: params.id },
    include: { employee: { select: { code: true, fullName: true } }, branch: { select: { name: true } }, attendance: true },
  });
  if (!s) return fail(404, "Không tìm thấy ca");
  return ok(s);
});

// PATCH — sửa/hủy ca (attendance.write). Hủy = status CANCELLED (KHÔNG hard-delete).
export const PATCH = handle(async (req, { params }) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const session = await getSession();
  const parsed = workShiftUpdateSchema.parse(await req.json());
  const before = await prisma.workShift.findUnique({ where: { id: params.id } });
  if (!before) return fail(404, "Không tìm thấy ca");
  const data: Record<string, unknown> = {};
  if (parsed.scheduledStartAt) data.scheduledStartAt = parseVnLocal(parsed.scheduledStartAt);
  if (parsed.scheduledEndAt) data.scheduledEndAt = parseVnLocal(parsed.scheduledEndAt);
  if (parsed.breakMinutes !== undefined) data.breakMinutes = parsed.breakMinutes;
  if (parsed.shiftLabel !== undefined) data.shiftLabel = parsed.shiftLabel;
  if (parsed.note !== undefined) data.note = parsed.note;
  if (parsed.status !== undefined) data.status = parsed.status;
  const start = (data.scheduledStartAt as Date) ?? before.scheduledStartAt;
  const end = (data.scheduledEndAt as Date) ?? before.scheduledEndAt;
  if (end.getTime() <= start.getTime()) return fail(422, "Giờ kết thúc phải sau giờ bắt đầu");
  const shift = await prisma.workShift.update({ where: { id: params.id }, data });
  const cancelled = parsed.status === "CANCELLED" && before.status !== "CANCELLED";
  await auditLog({ userId: session?.userId, action: cancelled ? "WORK_SHIFT_CANCELLED" : "WORK_SHIFT_UPDATED", entityType: "WorkShift", entityId: shift.id, changes: { fields: Object.keys(data) } });
  return ok(shift);
});
