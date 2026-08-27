export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission, HttpError } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { clearBusinessData } from "@/lib/maintenance-service";

// Xóa toàn bộ dữ liệu nghiệp vụ (giữ người dùng + phân quyền + cài đặt công ty).
// Chỉ Quản trị; phải gửi confirm = "XOA" để tránh bấm nhầm.
export const POST = handle(async (req, ctx) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "XOA") {
    throw new HttpError(400, 'Cần xác nhận: gõ "XOA" để xác nhận xóa dữ liệu nghiệp vụ.');
  }

  const counts = await clearBusinessData();

  // Ghi nhật ký mới (nằm ngoài dữ liệu vừa xóa).
  await prisma.auditLog
    .create({
      data: {
        userId: session.userId,
        action: "DATA_CLEAR",
        entityType: "System",
        entityId: "business",
        detail: "Xóa toàn bộ dữ liệu nghiệp vụ (giữ người dùng + cài đặt công ty)",
      },
    })
    .catch(() => {});

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return ok({ cleared: true, total, counts });
});
