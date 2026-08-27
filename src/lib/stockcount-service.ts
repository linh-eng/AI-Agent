// =============================================================================
// Kiểm kê định kỳ: chốt danh sách lô + tồn hệ thống; khi duyệt, cập nhật tồn lô
// về số thực đếm và ghi bút toán ADJUSTMENT cho chênh lệch.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextStockCountCode } from "./codes";

/** Tạo phiếu kiểm kê nháp: chốt các lô đang có tồn của kho. */
export async function createStockCount(
  warehouseId: string,
  note: string | null,
  userId: string
) {
  const batches = await prisma.stockBatch.findMany({
    where: { warehouseId, quantity: { gt: 0 } },
    orderBy: [{ productId: "asc" }, { expiryDate: "asc" }],
  });
  if (batches.length === 0)
    throw new HttpError(400, "Kho chưa có tồn để kiểm kê");

  const code = await nextStockCountCode();
  const count = await prisma.stockCount.create({
    data: {
      code,
      warehouseId,
      status: "DRAFT",
      note,
      createdById: userId,
      items: {
        create: batches.map((b) => ({
          productId: b.productId,
          batchId: b.id,
          systemQty: b.quantity,
        })),
      },
    },
  });
  return { id: count.id, code: count.code };
}

/** Duyệt phiếu kiểm kê: áp số thực đếm, điều chỉnh tồn + ghi bút toán. */
export async function postStockCount(
  countId: string,
  counted: { itemId: string; countedQty: number }[],
  userId: string
) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId },
    include: { items: true },
  });
  if (!count) throw new HttpError(404, "Không tìm thấy phiếu kiểm kê");
  if (count.status !== "DRAFT")
    throw new HttpError(400, "Phiếu kiểm kê đã được duyệt hoặc hủy");

  const countedMap = new Map(counted.map((c) => [c.itemId, c.countedQty]));

  return prisma.$transaction(async (tx) => {
    for (const item of count.items) {
      const countedQty = countedMap.get(item.id);
      if (countedQty === undefined) continue;

      await tx.stockCountItem.update({
        where: { id: item.id },
        data: { countedQty },
      });

      const batch = await tx.stockBatch.findUnique({ where: { id: item.batchId } });
      if (!batch) continue;
      const delta = countedQty - batch.quantity;
      if (Math.abs(delta) < 1e-9) continue;

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { quantity: countedQty },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: count.warehouseId,
          batchId: batch.id,
          type: "ADJUSTMENT",
          quantity: delta,
          refType: "STOCKCOUNT",
          refId: count.id,
          refCode: count.code,
          note: "Điều chỉnh kiểm kê",
        },
      });
    }

    const updated = await tx.stockCount.update({
      where: { id: countId },
      data: { status: "POSTED", countedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "STOCKCOUNT_POST",
        entityType: "StockCount",
        entityId: countId,
        detail: count.code,
      },
    });
    return { id: updated.id, code: updated.code };
  });
}
