export const dynamic = "force-dynamic";

import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { exportBackup } from "@/lib/backup-service";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// Tải toàn bộ dữ liệu về dưới dạng 1 tệp JSON (chỉ Quản trị).
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.USER_MANAGE);
  const backup = await exportBackup();
  const body = JSON.stringify(backup);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sophia-backup-${stamp()}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
