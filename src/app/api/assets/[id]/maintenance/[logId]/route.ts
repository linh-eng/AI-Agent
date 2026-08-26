export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { maintenanceCreateSchema } from "@/lib/validation";

// Sửa 1 bản ghi bảo trì / sửa chữa — ADMIN/MANAGER (asset.manage).
export const PATCH = handle(async (req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  const input = maintenanceCreateSchema.parse(await req.json());
  const row = await prisma.maintenanceLog.update({
    where: { id: ctx.params.logId },
    data: {
      type: input.type,
      description: input.description,
      cost: input.cost ?? null,
      vendor: input.vendor,
      performedBy: input.performedBy,
      performedAt: new Date(input.performedAt),
      expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
      deviceLocation: input.deviceLocation ?? null,
      note: input.note,
    },
  });
  return ok(row);
});

// Xóa 1 bản ghi bảo trì — ADMIN/MANAGER.
export const DELETE = handle(async (_req, ctx) => {
  await requirePermission(PERMISSIONS.ASSET_MANAGE);
  await prisma.maintenanceLog.delete({ where: { id: ctx.params.logId } });
  return ok({ deleted: true });
});
