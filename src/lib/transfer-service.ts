// =============================================================================
// Chuyển kho giữa các chi nhánh: rút lô ở kho nguồn theo FEFO, tạo/cộng lô
// tương ứng (giữ nguyên mã lô + HSD) ở kho đích. Ghi 2 bút toán mỗi lần tách lô.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextTransferCode } from "./codes";

export interface TransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  note?: string | null;
  items: { productId: string; quantity: number }[];
}

export async function createTransfer(input: TransferInput, userId: string) {
  if (input.fromWarehouseId === input.toWarehouseId)
    throw new HttpError(400, "Kho nguồn và kho đích phải khác nhau");

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const code = await nextTransferCode();

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.create({
      data: {
        code,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: "POSTED",
        note: input.note,
        createdById: userId,
        transferredAt: new Date(),
        items: {
          create: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      },
    });

    for (const item of input.items) {
      const p = byId.get(item.productId);
      if (!p) throw new HttpError(400, `Sản phẩm không tồn tại: ${item.productId}`);

      const batches = await tx.stockBatch.findMany({
        where: {
          productId: item.productId,
          warehouseId: input.fromWarehouseId,
          quantity: { gt: 0 },
        },
      });
      const available = batches.reduce((s, b) => s + b.quantity, 0);
      if (available < item.quantity)
        throw new HttpError(
          400,
          `"${p.name}" không đủ tồn ở kho nguồn (cần ${item.quantity} ${p.uom}, còn ${available})`
        );

      // FEFO: HSD sớm nhất trước (lô không HSD xếp sau), cùng HSD thì lô cũ trước.
      const sorted = [...batches].sort((a, b) => {
        const ax = a.expiryDate ? a.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bx = b.expiryDate ? b.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
        if (ax !== bx) return ax - bx;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      let remaining = item.quantity;
      for (const src of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(src.quantity, remaining);
        if (take <= 0) continue;
        remaining -= take;

        // Trừ ở kho nguồn
        await tx.stockBatch.update({
          where: { id: src.id },
          data: { quantity: { decrement: take } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: input.fromWarehouseId,
            batchId: src.id,
            type: "OUTBOUND",
            quantity: -take,
            refType: "TRANSFER",
            refId: transfer.id,
            refCode: transfer.code,
            note: "Chuyển đi",
          },
        });

        // Cộng ở kho đích (giữ nguyên mã lô + HSD)
        const destExisting = await tx.stockBatch.findFirst({
          where: {
            productId: item.productId,
            warehouseId: input.toWarehouseId,
            batchCode: src.batchCode ?? null,
            expiryDate: src.expiryDate ?? null,
          },
        });
        let destId: string;
        if (destExisting) {
          await tx.stockBatch.update({
            where: { id: destExisting.id },
            data: { quantity: { increment: take }, unitCost: src.unitCost ?? destExisting.unitCost },
          });
          destId = destExisting.id;
        } else {
          const createdBatch = await tx.stockBatch.create({
            data: {
              productId: item.productId,
              warehouseId: input.toWarehouseId,
              batchCode: src.batchCode,
              expiryDate: src.expiryDate,
              mfgDate: src.mfgDate,
              quantity: take,
              unitCost: src.unitCost,
              supplierId: src.supplierId,
            },
          });
          destId = createdBatch.id;
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: input.toWarehouseId,
            batchId: destId,
            type: "INBOUND",
            quantity: take,
            refType: "TRANSFER",
            refId: transfer.id,
            refCode: transfer.code,
            note: "Chuyển đến",
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "TRANSFER_POST",
        entityType: "StockTransfer",
        entityId: transfer.id,
        detail: transfer.code,
      },
    });

    return { id: transfer.id, code: transfer.code };
  });
}
