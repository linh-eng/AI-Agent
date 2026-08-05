export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handle(async (req) => {
  const body = await req.json();
  const { email, password } = loginSchema.parse(body);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });

  if (!user || !user.isActive) return fail(401, "Email hoặc mật khẩu không đúng");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail(401, "Email hoặc mật khẩu không đúng");

  const roles = user.roles.map((ur) => ur.role.code);
  const permissions = Array.from(
    new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code))
    )
  );

  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
  });

  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  // Ghi audit log đăng nhập (không chặn phản hồi nếu lỗi).
  await prisma.auditLog
    .create({ data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id } })
    .catch(() => {});

  return ok({ id: user.id, email: user.email, name: user.name, roles, permissions });
});