export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS, ROLES } from "@/lib/rbac";
import { userCreateSchema } from "@/lib/clinic-validation";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/clinic";

const VALID_ROLE_CODES = new Set<string>(Object.values(ROLES));

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: { select: { code: true, name: true } } } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  // KHÔNG trả passwordHash.
  return ok(users.map((u) => ({
    id: u.id, email: u.email, name: u.name, isActive: u.isActive, createdAt: u.createdAt,
    roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
  })));
});

export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = userCreateSchema.parse(await req.json());
  const email = parsed.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return fail(409, "Email đã tồn tại");

  const roleCodes = parsed.roleCodes.filter((c) => VALID_ROLE_CODES.has(c));
  const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true } });

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.name,
      passwordHash: await hashPassword(parsed.password),
      isActive: parsed.isActive ?? true,
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  await auditLog({
    userId: session.userId,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    changes: { email, roles: roleCodes },
  });
  return created({ id: user.id, email: user.email, name: user.name });
});
