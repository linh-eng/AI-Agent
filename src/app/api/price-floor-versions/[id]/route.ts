export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { floorVersionUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { updateFloorVersion } from "@/lib/price-floor-service";

export const GET = handle(async (_req, { params }) => {
  const session = await requireAuth();
  const fin = canSeeFinance(session);
  if (!fin && !session.permissions.includes(PERMISSIONS.PRICEFLOOR_READ)) return fail(403, "Không có quyền xem giá sàn");
  const v = await prisma.servicePriceFloorVersion.findUnique({ where: { id: params.id }, include: { lines: { orderBy: { orderIndex: "asc" } }, service: { select: { code: true, name: true, standardPrice: true } } } });
  if (!v) return fail(404, "Không tìm thấy version");
  return ok({ ...v, lines: fin ? v.lines : null, totalCost: fin ? Number(v.totalCost) : null });
});

// Sửa version DRAFT/PENDING (thay lines + margin/method). Cần pricefloor.write.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const patch = floorVersionUpdateSchema.parse(await req.json());
  const version = await updateFloorVersion(params.id, patch);
  await auditLog({ userId: session.userId, action: "PRICE_FLOOR_VERSION_UPDATE", entityType: "ServicePriceFloorVersion", entityId: version.id, changes: { version: version.version, floorPrice: Number(version.floorPrice) } });
  return ok(version);
});
