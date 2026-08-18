export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Xóa 1 đợt thanh toán (kèm file đính kèm của đợt đó) — ADMIN/MANAGER.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  await prisma.assetPayment.delete({ where: { id: ctx.params.pid } });
  return ok({ deleted: true });
});
