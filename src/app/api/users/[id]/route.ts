export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";

export const PATCH = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = ctx.params.id;
  const input = userUpdateSchema.parse(await req.json());

  // Chặn tự khoá chính mình.
  if (id === session.userId && input.isActive === false)
    return fail(400, "Không thể tự khoá tài khoản của mình");

  await prisma.$transaction(async (tx) => {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password) data.passwordHash = await hashPassword(input.password);
    if (Object.keys(data).length) await tx.user.update({ where: { id }, data });

    if (input.roles) {
      const roles = await tx.role.findMany({ where: { code: { in: input.roles } } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id })),
        skipDuplicates: true,
      });
    }
  });

  await prisma.auditLog.create({
    data: { userId: session.userId, action: "USER_UPDATE", entityType: "User", entityId: id },
  });
  return ok({ id });
});
