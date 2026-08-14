export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { scheduleCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_SCHEDULE_MANAGE);
  const parsed = scheduleCreateSchema.parse(await req.json());
  if (parsed.startTime >= parsed.endTime) return fail(422, "Giờ kết thúc phải sau giờ bắt đầu");
  const row = await prisma.employeeSchedule.create({
    data: { employeeId: params.id, dayOfWeek: parsed.dayOfWeek, startTime: parsed.startTime, endTime: parsed.endTime, shift: parsed.shift ?? null, effectiveFrom: parsed.effectiveFrom ?? null, effectiveTo: parsed.effectiveTo ?? null },
  });
  await auditLog({ userId: session.userId, action: "STAFF_SCHEDULE_ADDED", entityType: "Employee", entityId: params.id, changes: { dayOfWeek: parsed.dayOfWeek, startTime: parsed.startTime, endTime: parsed.endTime } });
  return created(row);
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_SCHEDULE_MANAGE);
  const sid = new URL(req.url).searchParams.get("sid");
  if (!sid) return fail(400, "Thiếu sid");
  const row = await prisma.employeeSchedule.findFirst({ where: { id: sid, employeeId: params.id } });
  if (!row) return fail(404, "Không tìm thấy lịch");
  await prisma.employeeSchedule.delete({ where: { id: sid } });
  await auditLog({ userId: session.userId, action: "STAFF_SCHEDULE_REMOVED", entityType: "Employee", entityId: params.id, changes: { sid } });
  return ok({ ok: true });
});
