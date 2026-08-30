export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { checkThrottle, recordFailure, recordSuccess, getClientIp } from "@/lib/rate-limit";
import { ROLE_PERMISSIONS, type RoleCode } from "@/lib/rbac";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handle(async (req) => {
  const body = await req.json();
  const { email, password } = loginSchema.parse(body);
  const emailNorm = email.toLowerCase();
  const ip = getClientIp(req);
  const keys = [`staff:ip:${ip}`, `staff:acct:${emailNorm}`];

  // Chặn brute-force TRƯỚC khi kiểm tra mật khẩu.
  const throttled = await checkThrottle(keys);
  if (throttled.locked) {
    return fail(429, `Quá nhiều lần thử. Vui lòng thử lại sau ${throttled.retryAfterSec}s`);
  }

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });

  // Lỗi chung + ghi nhận thất bại (áp dụng dù account tồn tại hay không).
  const invalid = async () => {
    await recordFailure(keys, "staff-login");
    return fail(401, "Email hoặc mật khẩu không đúng");
  };
  if (!user || !user.isActive) return invalid();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalid();

  await recordSuccess(keys);

  const roles = user.roles.map((ur) => ur.role.code);
  // Quyền theo vai trò lấy từ MÃ NGUỒN (src/lib/rbac.ts) — nguồn sự thật — để khi
  // cập nhật code (thêm quyền mới) người dùng có ngay sau khi đăng nhập lại, KHÔNG
  // cần seed lại DB. Vai trò lạ (không có trong code) thì fallback quyền lưu ở DB.
  const permSet = new Set<string>();
  for (const ur of user.roles) {
    const fromCode = ROLE_PERMISSIONS[ur.role.code as RoleCode];
    if (fromCode) fromCode.forEach((p) => permSet.add(p));
    else ur.role.permissions.forEach((rp) => permSet.add(rp.permission.code));
  }
  // Quyền BỔ SUNG cấp riêng cho tài khoản (ngoài vai trò) — hợp nhất.
  const extraPermissions = user.extraPermissions ?? [];
  extraPermissions.forEach((p) => permSet.add(p));
  const permissions = Array.from(permSet);

  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    extraPermissions,
  });

  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  // Ghi audit log đăng nhập (không chặn phản hồi nếu lỗi).
  await prisma.auditLog
    .create({ data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id } })
    .catch(() => {});

  return ok({ id: user.id, email: user.email, name: user.name, roles, permissions });
});