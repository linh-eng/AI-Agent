export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS, ROLES } from "@/lib/rbac";
import { userUpdateSchema } from "@/lib/clinic-validation";
// (ROLES đã import ở trên — dùng cho VALID_ROLE_CODES và chặn xóa Admin cuối)
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/clinic";
import { sanitizeExtra } from "@/lib/user-permissions";

const VALID_ROLE_CODES = new Set<string>(Object.values(ROLES));

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const u = await prisma.user.findUnique({
    where: { id: params.id },
    include: { roles: { include: { role: { select: { code: true, name: true } } } } },
  });
  if (!u) return fail(404, "Không tìm thấy người dùng");
  return ok({ id: u.id, email: u.email, name: u.name, isActive: u.isActive, roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })), extraPermissions: u.extraPermissions ?? [] });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = userUpdateSchema.parse(await req.json());
  const current = await prisma.user.findUnique({
    where: { id: params.id },
    include: { roles: { include: { role: { select: { code: true } } } } },
  });
  if (!current) return fail(404, "Không tìm thấy người dùng");

  // Không cho tự vô hiệu hóa chính mình (tránh khóa mất tài khoản admin đang dùng).
  if (params.id === session.userId && parsed.isActive === false) {
    return fail(409, "Không thể vô hiệu hóa chính tài khoản đang đăng nhập");
  }

  // BẤT BIẾN "Admin cuối cùng": chặn CẢ hai đường bypass qua PATCH —
  // (a) gỡ vai trò ADMIN khỏi admin cuối, (b) khóa (isActive=false) admin cuối.
  const currentIsActiveAdmin = current.isActive && current.roles.some((r) => r.role.code === ROLES.ADMIN);
  if (currentIsActiveAdmin) {
    const willBeActive = parsed.isActive !== undefined ? parsed.isActive : current.isActive;
    const willHaveAdmin = parsed.roleCodes !== undefined ? parsed.roleCodes.includes(ROLES.ADMIN) : true;
    const willRemainActiveAdmin = willBeActive && willHaveAdmin;
    if (!willRemainActiveAdmin) {
      const otherActiveAdmins = await prisma.user.count({
        where: { id: { not: params.id }, isActive: true, roles: { some: { role: { code: ROLES.ADMIN } } } },
      });
      if (otherActiveAdmins === 0) {
        return fail(409, "Không thể gỡ quyền Admin hoặc khóa tài khoản Admin cuối cùng");
      }
    }
  }

  const beforeRoles = current.roles.map((r) => r.role.code).sort();
  const beforeExtra = (current.extraPermissions ?? []).slice().sort();

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
  if (parsed.password) data.passwordHash = await hashPassword(parsed.password);

  // Quyền BỔ SUNG — thay toàn bộ nếu gửi (đã lọc bỏ user.manage + quyền lạ).
  let afterExtra = beforeExtra;
  if (parsed.extraPermissions !== undefined) {
    afterExtra = sanitizeExtra(parsed.extraPermissions).slice().sort();
    data.extraPermissions = afterExtra;
  }

  // Thay toàn bộ vai trò nếu gửi roleCodes.
  let afterRoles = beforeRoles;
  if (parsed.roleCodes) {
    const roleCodes = parsed.roleCodes.filter((c) => VALID_ROLE_CODES.has(c));
    const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true } });
    await prisma.userRole.deleteMany({ where: { userId: params.id } });
    data.roles = { create: roles.map((r) => ({ roleId: r.id })) };
    afterRoles = roleCodes.slice().sort();
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    changes: {
      resetPassword: !!parsed.password, // KHÔNG log mật khẩu/hash
      ...(parsed.isActive !== undefined ? { isActive: { before: current.isActive, after: user.isActive } } : {}),
      ...(parsed.roleCodes ? { roles: { before: beforeRoles, after: afterRoles } } : {}),
      ...(parsed.extraPermissions !== undefined ? { extraPermissions: { before: beforeExtra, after: afterExtra } } : {}),
    },
  });
  return ok({ id: user.id, email: user.email, name: user.name, isActive: user.isActive });
});

// Xóa vĩnh viễn một tài khoản. Chặn tự xóa chính mình và xóa Admin cuối cùng.
export const DELETE = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  if (params.id === session.userId) return fail(409, "Không thể xóa chính tài khoản đang đăng nhập");

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { roles: { include: { role: { select: { code: true } } } } },
  });
  if (!target) return fail(404, "Không tìm thấy người dùng");

  // Không cho xóa Admin cuối cùng (tránh khóa mất quyền quản trị).
  const isAdmin = target.roles.some((r) => r.role.code === ROLES.ADMIN);
  if (isAdmin) {
    const admins = await prisma.user.count({
      where: { isActive: true, roles: { some: { role: { code: ROLES.ADMIN } } } },
    });
    if (admins <= 1) return fail(409, "Không thể xóa tài khoản Admin cuối cùng");
  }

  // Nhật ký đăng nhập (audit_logs.userId) là quan hệ tùy chọn → tự set null khi xóa.
  await prisma.user.delete({ where: { id: params.id } });
  await auditLog({
    userId: session.userId,
    action: "USER_DELETED",
    entityType: "User",
    entityId: params.id,
    changes: { email: target.email },
  });
  return ok({ id: params.id });
});
