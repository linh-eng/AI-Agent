// =============================================================================
// Nghiệp vụ nhập kho: tạo phiếu nhập (ghi sổ ngay), sinh/cộng lô + biến động tồn.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextReceiptCode } from "./codes";
import type { ReceiptCreateInput } from "./validation";

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Tạo & ghi sổ phiếu nhập trong 1 transaction. Trả về id + code. */
export async function createReceipt(input: ReceiptCreateInput, userId: string) {
  // Tải sản phẩm để biết trackingMode + ràng buộc HSD.
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const p = byId.get(item.productId);
    if (!p) throw new HttpError(400, `Sản phẩm không tồn tại: ${item.productId}`);
    if (p.trackingMode === "LOT") {
      if (!item.batchCode)
        throw new HttpError(400, `Sản phẩm "${p.name}" quản lý theo lô — cần nhập mã lô`);
      if (p.requiresExpiry && !item.expiryDate)
        throw new HttpError(400, `Sản phẩm "${p.name}" cần nhập hạn sử dụng (HSD)`);
    }
  }

  const code = await nextReceiptCode();

  return prisma.$transaction(async (tx) => {
    const receipt = await tx.goodsReceipt.create({
      data: {
        code,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        status: "POSTED",
        note: input.note,
        createdById: userId,
        receivedAt: new Date(),
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            batchCode: i.batchCode,
            expiryDate: parseDate(i.expiryDate),
            mfgDate: parseDate(i.mfgDate),
            quantity: i.quantity,
            unitCost: i.unitCost ?? null,
          })),
        },
      },
    });

    for (const item of input.items) {
      const p = byId.get(item.productId)!;
      const expiry = p.trackingMode === "LOT" ? parseDate(item.expiryDate) : null;
      const batchCode = p.trackingMode === "LOT" ? item.batchCode : null;

      // Tìm lô khớp (cùng sản phẩm/kho/mã lô/HSD) để cộng dồn, không thì tạo mới.
      const existing = await tx.stockBatch.findFirst({
        where: {
          productId: item.productId,
          warehouseId: input.warehouseId,
          batchCode: batchCode ?? null,
          expiryDate: expiry ?? null,
        },
      });

      let batchId: string;
      if (existing) {
        await tx.stockBatch.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: item.quantity },
            unitCost: item.unitCost ?? existing.unitCost,
            supplierId: input.supplierId,
            mfgDate: parseDate(item.mfgDate) ?? existing.mfgDate,
          },
        });
        batchId = existing.id;
      } else {
        const created = await tx.stockBatch.create({
          data: {
            productId: item.productId,
            warehouseId: input.warehouseId,
            batchCode,
            expiryDate: expiry,
            mfgDate: parseDate(item.mfgDate),
            quantity: item.quantity,
            unitCost: item.unitCost ?? null,
            supplierId: input.supplierId,
          },
        });
        batchId = created.id;
      }

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: input.warehouseId,
          batchId,
          type: "INBOUND",
          quantity: item.quantity,
          refType: "RECEIPT",
          refId: receipt.id,
          refCode: receipt.code,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "RECEIPT_POST",
        entityType: "GoodsReceipt",
        entityId: receipt.id,
        detail: receipt.code,
      },
    });

    return { id: receipt.id, code: receipt.code };
  });
}
