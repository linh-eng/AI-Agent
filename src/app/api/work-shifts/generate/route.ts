export const dynamic = "force-dynamic";

import { created, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";
import { workShiftGenerateSchema } from "@/lib/clinic-validation";
import { generateShiftsFromSchedule } from "@/lib/attendance";
import { parseVnLocal } from "@/lib/timezone";

// POST /api/work-shifts/generate  → sinh ca dated từ mẫu tuần (attendance.write, IDEMPOTENT).
export const POST = handle(async (req) => {
  await requirePermission(PERMISSIONS.ATTENDANCE_WRITE);
  const session = await getSession();
  const input = workShiftGenerateSchema.parse(await req.json());
  const res = await generateShiftsFromSchedule({
    employeeId: input.employeeId, from: parseVnLocal(input.from), to: parseVnLocal(input.to),
    branchId: input.branchId ?? null, createdBy: session?.name ?? null,
  });
  await auditLog({ userId: session?.userId, action: "WORK_SHIFT_CREATED", entityType: "Employee", entityId: input.employeeId, changes: { generated: res.created, skipped: res.skipped, from: input.from, to: input.to } });
  return created(res);
});
