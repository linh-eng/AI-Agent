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
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role.code),
    }))
  );
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const input = userCreateSchema.parse(await req.json());

  const existed = await prisma.user.findUnique({ where: { email: input.email } });
  if (existed) return fail(409, "Email đã tồn tại");

  const roles = await prisma.role.findMany({ where: { code: { in: input.roles } } });
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "USER_CREATE", entityType: "User", entityId: user.id, detail: user.email },
  });
  return created({ id: user.id });
});
