export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      roles: { select: { role: { select: { code: true, name: true } } } },
    },
  });
  return ok(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role),
    }))
  );
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const input = userCreateSchema.parse(await req.json());

  const roles = await prisma.role.findMany({ where: { code: { in: input.roleCodes } } });
  if (roles.length !== input.roleCodes.length) return fail(422, "Có vai trò không hợp lệ");

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await hashPassword(input.password),
      isActive: input.isActive,
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
    select: { id: true, email: true, name: true },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "CREATE", entityType: "User", entityId: user.id },
  });
  return created(user);
});
