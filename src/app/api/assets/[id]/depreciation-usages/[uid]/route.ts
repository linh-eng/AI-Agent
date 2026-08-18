export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Xóa 1 bản ghi sản lượng — ADMIN/MANAGER.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  await prisma.depreciationUsage.delete({ where: { id: ctx.params.uid } });
  return ok({ deleted: true });
});
