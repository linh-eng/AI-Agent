export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS, ROLES } from "@/lib/rbac";
import { userUpdateSchema } from "@/lib/clinic-validation";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/clinic";

const VALID_ROLE_CODES = new Set<string>(Object.values(ROLES));

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const u = await prisma.user.findUnique({
    where: { id: params.id },
    include: { roles: { include: { role: { select: { code: true, name: true } } } } },
  });
  if (!u) return fail(404, "Không tìm thấy người dùng");
  return ok({ id: u.id, email: u.email, name: u.name, isActive: u.isActive, roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })) });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = userUpdateSchema.parse(await req.json());
  const current = await prisma.user.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy người dùng");

  // Không cho tự vô hiệu hóa chính mình (tránh khóa mất tài khoản admin đang dùng).
  if (params.id === session.userId && parsed.isActive === false) {
    return fail(409, "Không thể vô hiệu hóa chính tài khoản đang đăng nhập");
  }

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
  if (parsed.password) data.passwordHash = await hashPassword(parsed.password);

  // Thay toàn bộ vai trò nếu gửi roleCodes.
  if (parsed.roleCodes) {
    const roleCodes = parsed.roleCodes.filter((c) => VALID_ROLE_CODES.has(c));
    const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true } });
    await prisma.userRole.deleteMany({ where: { userId: params.id } });
    data.roles = { create: roles.map((r) => ({ roleId: r.id })) };
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    changes: { isActive: user.isActive, resetPassword: !!parsed.password, roles: parsed.roleCodes },
  });
  return ok({ id: user.id, email: user.email, name: user.name, isActive: user.isActive });
});
