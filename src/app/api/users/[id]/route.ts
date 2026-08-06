export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";

export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const input = userUpdateSchema.parse(await req.json());

  // Không cho tự vô hiệu hóa chính mình (tránh tự khóa)
  if (input.isActive === false && params.id === session.userId) {
    return fail(409, "Không thể tự vô hiệu hóa tài khoản của chính mình");
  }

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  // Cập nhật vai trò (nếu gửi lên): reset rồi gán lại
  if (input.roleCodes) {
    const roles = await prisma.role.findMany({ where: { code: { in: input.roleCodes } } });
    if (roles.length !== input.roleCodes.length) return fail(422, "Có vai trò không hợp lệ");
    data.roles = {
      deleteMany: {},
      create: roles.map((r) => ({ roleId: r.id })),
    };
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, name: true, isActive: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      changes: { passwordReset: !!input.password, roles: input.roleCodes ?? undefined },
    },
  });
  return ok(user);
});
