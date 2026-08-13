export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionStaffCreateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance, auditLog } from "@/lib/clinic";

// Danh sách nhân sự của một buổi (kèm tổng phí nếu có quyền tài chính).
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const session = await getSession();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return fail(400, "Thiếu sessionId");
  const rows = await prisma.sessionStaff.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const canSee = canSeeFinance(session);
  const masked = rows.map((r) => maskFinance(r, canSee, ["fee"]));
  const totalFee = canSee ? rows.reduce((s, r) => s + Number(r.fee ?? 0), 0) : null;
  return ok({ staff: masked, totalFee, canSeeFinance: canSee });
});

// Gán nhân sự vào buổi kèm vai trò + phí. Quyền: người ghi buổi (TREATMENT_WRITE).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = sessionStaffCreateSchema.parse(await req.json());
  const treatmentSession = await prisma.treatmentSession.findUnique({ where: { id: parsed.sessionId }, select: { id: true } });
  if (!treatmentSession) return fail(404, "Không tìm thấy buổi thực hiện");

  // Nếu chọn từ danh mục nhân sự, snapshot tên; phí mặc định lấy từ nhân sự nếu bỏ trống.
  let staffName = parsed.staffName;
  let fee = parsed.fee ?? null;
  if (parsed.employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: parsed.employeeId } });
    if (emp) {
      staffName = staffName || emp.fullName;
      if (fee == null && emp.defaultFee != null) fee = Number(emp.defaultFee);
    }
  }

  const staff = await prisma.sessionStaff.create({
    data: {
      sessionId: parsed.sessionId,
      employeeId: parsed.employeeId ?? null,
      staffName,
      role: parsed.role,
      fee,
      note: parsed.note ?? null,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "SESSION_STAFF_ADDED",
    entityType: "SessionStaff",
    entityId: staff.id,
    changes: { sessionId: parsed.sessionId, role: parsed.role },
  });
  return created(staff);
});
