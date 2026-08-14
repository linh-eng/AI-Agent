export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission, HttpError } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { importBackup, reviveDates, type BackupFile } from "@/lib/backup-service";

// Khôi phục dữ liệu từ tệp sao lưu JSON — GHI ĐÈ toàn bộ dữ liệu hiện tại (chỉ Quản trị).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE);

  const text = await req.text();
  if (!text || text.length < 2) throw new HttpError(400, "Chưa nhận được tệp sao lưu.");

  let backup: BackupFile;
  try {
    backup = JSON.parse(text, reviveDates) as BackupFile;
  } catch {
    throw new HttpError(400, "Tệp sao lưu hỏng hoặc không phải JSON hợp lệ.");
  }

  const counts = await importBackup(backup);

  // Ghi audit sau khi phục hồi xong (bản ghi này nằm ngoài dữ liệu vừa nạp).
  await prisma.auditLog
    .create({
      data: {
        userId: session.userId,
        action: "DATA_RESTORE",
        entityType: "System",
        entityId: "backup",
        detail: `Phục hồi từ bản sao lưu ${backup.exportedAt ?? "?"}`,
      },
    })
    .catch(() => {});

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return ok({ restored: true, total, counts });
});
