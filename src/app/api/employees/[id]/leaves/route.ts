export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { leaveCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_SCHEDULE_MANAGE);
  const parsed = leaveCreateSchema.parse(await req.json());
  if (parsed.toAt <= parsed.fromAt) return fail(422, "Thời gian kết thúc phải sau bắt đầu");
  const row = await prisma.employeeLeave.create({
    data: { employeeId: params.id, type: parsed.type, fromAt: parsed.fromAt, toAt: parsed.toAt, reason: parsed.reason ?? null, createdBy: session.name },
  });
  await auditLog({ userId: session.userId, action: "STAFF_LEAVE_ADDED", entityType: "Employee", entityId: params.id, changes: { type: parsed.type, fromAt: parsed.fromAt.toISOString(), toAt: parsed.toAt.toISOString() } });
  return created(row);
});

export const DELETE = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_SCHEDULE_MANAGE);
  const lid = new URL(req.url).searchParams.get("lid");
  if (!lid) return fail(400, "Thiếu lid");
  const row = await prisma.employeeLeave.findFirst({ where: { id: lid, employeeId: params.id } });
  if (!row) return fail(404, "Không tìm thấy đơn nghỉ");
  await prisma.employeeLeave.delete({ where: { id: lid } });
  await auditLog({ userId: session.userId, action: "STAFF_LEAVE_REMOVED", entityType: "Employee", entityId: params.id, changes: { lid } });
  return ok({ ok: true });
});
