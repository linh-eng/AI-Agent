export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Tải/xem 1 file đính kèm (giải mã base64 -> trả file). Quyền xem tài sản.
export const GET = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_READ);
  const a = await prisma.assetAttachment.findUnique({ where: { id: ctx.params.aid } });
  if (!a) return fail(404, "Không tìm thấy file đính kèm");

  // data có thể là data URI ("data:...;base64,XXXX") hoặc base64 thuần.
  const base64 = a.data.includes(",") ? a.data.slice(a.data.indexOf(",") + 1) : a.data;
  const buf = Buffer.from(base64, "base64");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": a.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(a.filename)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
});

// Xóa 1 file đính kèm — ADMIN/MANAGER.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  await prisma.assetAttachment.delete({ where: { id: ctx.params.aid } });
  return ok({ deleted: true });
});
