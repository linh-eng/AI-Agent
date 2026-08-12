export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";

// Danh sách lô kho còn khả dụng (available = quantity - reservedQty) để chọn khi
// lập vật tư buổi. Chỉ đọc — cần quyền vật tư.
export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const lots = await prisma.lot.findMany({
    where: {
      quantity: { gt: 0 },
      ...(q
        ? {
            OR: [
              { lotNumber: { contains: q, mode: "insensitive" } },
              { product: { name: { contains: q, mode: "insensitive" } } },
              { product: { sku: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      product: { select: { name: true, sku: true, uom: true } },
      warehouse: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(
    lots.map((l) => ({
      id: l.id,
      lotNumber: l.lotNumber,
      productName: l.product.name,
      sku: l.product.sku,
      uom: l.product.uom,
      warehouse: l.warehouse.code,
      warehouseId: l.warehouseId,
      quantity: l.quantity,
      reservedQty: l.reservedQty,
      available: l.quantity - l.reservedQty,
    }))
  );
});
