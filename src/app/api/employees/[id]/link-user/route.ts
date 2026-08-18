export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { employeeLinkUserSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// POST /api/employees/[id]/link-user  { userId: string | null }
// HR-PH1 — liên kết TÙY CHỌN 1-1 tài khoản đăng nhập ↔ hồ sơ nhân sự (self-view).
//  * userId=null → gỡ liên kết. userId=string → liên kết (theo FK).
//  * 1 User ↔ tối đa 1 Employee (unique). 1 Employee ↔ tối đa 1 User (cột userId).
//  * KHÔNG tự tạo tài khoản. KHÔNG suy quyền RBAC từ liên kết. Gated staff.write.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.STAFF_WRITE);
  const { userId } = employeeLinkUserSchema.parse(await req.json());
  const emp = await prisma.employee.findUnique({ where: { id: params.id }, select: { id: true, userId: true, code: true } });
  if (!emp) return fail(404, "Không tìm thấy nhân sự");

  if (userId === null) {
    if (!emp.userId) return ok({ id: emp.id, userId: null }); // đã không liên kết — idempotent
    await prisma.employee.update({ where: { id: emp.id }, data: { userId: null } });
    await auditLog({ userId: session.userId, action: "EMPLOYEE_USER_UNLINKED", entityType: "Employee", entityId: emp.id, changes: { from: emp.userId, to: null } });
    return ok({ id: emp.id, userId: null });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return fail(422, "Tài khoản không tồn tại");
  // 1 User chỉ gắn 1 Employee: chặn nếu User đã gắn nhân sự khác.
  const existing = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (existing && existing.id !== emp.id) return fail(422, "Tài khoản đã liên kết với nhân sự khác");

  await prisma.employee.update({ where: { id: emp.id }, data: { userId } });
  await auditLog({ userId: session.userId, action: "EMPLOYEE_USER_LINKED", entityType: "Employee", entityId: emp.id, changes: { from: emp.userId ?? null, to: userId } });
  return ok({ id: emp.id, userId });
});
