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

export const DELETE = handle(async (_req, ctx) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = ctx.params.id;

  if (id === session.userId) return fail(400, "Không thể tự xoá tài khoản của mình");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      _count: {
        select: {
          receipts: true,
          issues: true,
          transfers: true,
          serviceUsages: true,
          stockCounts: true,
          maintenance: true,
          shotLogs: true,
        },
      },
    },
  });
  if (!user) return fail(404, "Không tìm thấy người dùng");

  // Chặn xoá người dùng đã phát sinh chứng từ (giữ toàn vẹn dữ liệu) — nên khoá thay vì xoá.
  const docs =
    user._count.receipts +
    user._count.issues +
    user._count.transfers +
    user._count.serviceUsages +
    user._count.stockCounts +
    user._count.maintenance +
    user._count.shotLogs;
  if (docs > 0)
    return fail(
      400,
      "Người dùng đã phát sinh chứng từ nên không thể xoá. Hãy khoá tài khoản thay vì xoá để giữ lịch sử."
    );

  // Không xoá quản trị viên cuối cùng.
  const isAdmin = user.roles.some((r) => r.role.code === "ADMIN");
  if (isAdmin) {
    const adminCount = await prisma.userRole.count({ where: { role: { code: "ADMIN" } } });
    if (adminCount <= 1) return fail(400, "Không thể xoá quản trị viên duy nhất");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });
  await prisma.auditLog.create({
    data: { userId: session.userId, action: "USER_DELETE", entityType: "User", entityId: id, detail: user.email },
  });
  return ok({ id });
});
