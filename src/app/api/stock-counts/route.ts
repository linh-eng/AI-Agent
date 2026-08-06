export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stockCountCreateSchema } from "@/lib/validation";
import { createStockCount } from "@/lib/stockcount-service";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.PRODUCT_READ);
  const counts = await prisma.stockCount.findMany({
    orderBy: { createdAt: "desc" },
    include: { lines: { select: { expected: true, scanned: true } } },
  });
  // Đính kèm tên kho
  const whs = await prisma.warehouse.findMany({ select: { id: true, code: true, name: true } });
  const whMap = new Map(whs.map((w) => [w.id, w]));
  const rows = counts.map((c) => {
    const missing = c.lines.filter((l) => l.expected && !l.scanned).length;
    const extra = c.lines.filter((l) => !l.expected && l.scanned).length;
    return {
      id: c.id,
      number: c.number,
      status: c.status,
      warehouse: c.warehouseId ? whMap.get(c.warehouseId) : null,
      lineCount: c.lines.length,
      missing,
      extra,
      createdAt: c.createdAt,
    };
  });
  return ok(rows);
});

export const POST = handle(async (req) => {
  // Kiểm kê do thủ kho thực hiện (dùng quyền ghi kho)
  const session = await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const { warehouseId, note } = stockCountCreateSchema.parse(await req.json());
  const count = await createStockCount(warehouseId, note ?? null, session.userId);
  return created(count);
});
