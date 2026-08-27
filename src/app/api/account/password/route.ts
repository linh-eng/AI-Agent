export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAuth } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";

/** Người dùng tự đổi mật khẩu của chính mình. */
export const POST = handle(async (req) => {
  const session = await requireAuth();
  const input = changePasswordSchema.parse(await req.json());

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const okPwd = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!okPwd) return fail(400, "Mật khẩu hiện tại không đúng");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "PASSWORD_CHANGE", entityType: "User", entityId: user.id },
  });
  return ok({ id: user.id });
});
