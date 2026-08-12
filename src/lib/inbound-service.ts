// =============================================================================
// Nghiệp vụ nhập kho: tạo phiếu nhập (ghi sổ ngay), sinh/cộng lô + biến động tồn.
// Sửa/hủy phiếu đã ghi sổ: hủy = hoàn tồn (ghi biến động đảo chiều) + đánh dấu
// CANCELLED; sửa = hủy phiếu cũ rồi tạo phiếu mới (giữ nguyên bút toán, có lý do).
// =============================================================================
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextReceiptCode } from "./codes";
import type { ReceiptCreateInput } from "./validation";

type Tx = Prisma.TransactionClient;

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Kiểm tra ràng buộc mã lô/HSD theo trackingMode trước khi ghi sổ. */
async function validateItems(input: ReceiptCreateInput) {
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
  return byId;
}

/** Ghi sổ 1 phiếu nhập trong transaction đang mở. Trả về id + code. */
async function postReceiptTx(
  tx: Tx,
  input: ReceiptCreateInput,
  userId: string,
  byId: Map<string, { id: string; trackingMode: string }>,
  note?: string | null
) {
  const code = await nextReceiptCode();
  const receipt = await tx.goodsReceipt.create({
    data: {
      code,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      status: "POSTED",
      note: note ?? input.note,
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
}

/** Tạo & ghi sổ phiếu nhập trong 1 transaction. Trả về id + code. */
export async function createReceipt(input: ReceiptCreateInput, userId: string) {
  const byId = await validateItems(input);
  return prisma.$transaction((tx) => postReceiptTx(tx, input, userId, byId));
}

/**
 * Đảo bút toán của 1 phiếu nhập đã ghi sổ: trừ lại phần đã cộng vào lô + ghi
 * biến động âm. Chặn nếu hàng đã được xuất/dùng bớt khiến tồn lô không đủ để
 * hoàn (tránh đẩy tồn xuống âm). Dùng chung cho hủy và sửa.
 */
async function reverseReceiptTx(
  tx: Tx,
  receiptId: string,
  reason: string,
  userId: string,
  refCode: string
) {
  const movements = await tx.stockMovement.findMany({
    where: { refType: "RECEIPT", refId: receiptId },
  });

  // Gộp số lượng đã nhập theo lô để kiểm tra tồn khả dụng trước khi hoàn.
  const needByBatch = new Map<string, number>();
  for (const m of movements) {
    if (!m.batchId) continue;
    needByBatch.set(m.batchId, (needByBatch.get(m.batchId) ?? 0) + m.quantity);
  }

  for (const [batchId, need] of needByBatch) {
    const batch = await tx.stockBatch.findUnique({ where: { id: batchId } });
    if (!batch) continue;
    if (batch.quantity + 1e-9 < need) {
      const p = await tx.product.findUnique({ where: { id: batch.productId } });
      throw new HttpError(
        400,
        `Không thể hủy/sửa: hàng của lô "${batch.batchCode ?? p?.name ?? batchId}" đã được xuất/dùng bớt ` +
          `(cần hoàn ${need}, tồn còn ${batch.quantity}). Hãy hoàn/thu hồi hàng trước.`
      );
    }
  }

  // Đủ điều kiện — trừ lại tồn & ghi biến động đảo chiều cho từng lô.
  for (const [batchId, need] of needByBatch) {
    const batch = await tx.stockBatch.findUnique({ where: { id: batchId } });
    if (!batch) continue;
    await tx.stockBatch.update({
      where: { id: batchId },
      data: { quantity: { decrement: need } },
    });
    await tx.stockMovement.create({
      data: {
        productId: batch.productId,
        warehouseId: batch.warehouseId,
        batchId,
        type: "ADJUSTMENT",
        quantity: -need,
        refType: "RECEIPT_CANCEL",
        refId: receiptId,
        refCode,
        note: `Hủy phiếu nhập: ${reason}`,
      },
    });
  }
}

/** Hủy phiếu nhập đã ghi sổ: hoàn tồn + đánh dấu CANCELLED. Bắt buộc lý do. */
export async function cancelReceipt(id: string, reason: string, userId: string) {
  const receipt = await prisma.goodsReceipt.findUnique({ where: { id } });
  if (!receipt) throw new HttpError(404, "Không tìm thấy phiếu nhập");
  if (receipt.status === "CANCELLED")
    throw new HttpError(400, "Phiếu nhập đã bị hủy trước đó");

  return prisma.$transaction(async (tx) => {
    await reverseReceiptTx(tx, id, reason, userId, receipt.code);
    await tx.goodsReceipt.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "RECEIPT_CANCEL",
        entityType: "GoodsReceipt",
        entityId: id,
        detail: `${receipt.code} — ${reason}`,
      },
    });
    return { id, code: receipt.code };
  });
}

/**
 * Sửa phiếu nhập đã ghi sổ = hủy phiếu cũ (hoàn tồn) + tạo phiếu mới với dữ liệu
 * mới, tất cả trong 1 transaction. Trả về phiếu mới. Giữ phiếu cũ để tra cứu.
 */
export async function updateReceipt(
  id: string,
  input: ReceiptCreateInput,
  reason: string,
  userId: string
) {
  const old = await prisma.goodsReceipt.findUnique({ where: { id } });
  if (!old) throw new HttpError(404, "Không tìm thấy phiếu nhập");
  if (old.status === "CANCELLED")
    throw new HttpError(400, "Phiếu nhập đã bị hủy — không thể sửa");
  const byId = await validateItems(input);

  return prisma.$transaction(async (tx) => {
    await reverseReceiptTx(tx, id, `Sửa phiếu — ${reason}`, userId, old.code);
    const fresh = await postReceiptTx(
      tx,
      input,
      userId,
      byId,
      input.note ? `${input.note} (sửa từ ${old.code})` : `Sửa từ ${old.code}`
    );
    await tx.goodsReceipt.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: `Đã sửa thành ${fresh.code}. Lý do: ${reason}`,
        cancelledAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "RECEIPT_EDIT",
        entityType: "GoodsReceipt",
        entityId: id,
        detail: `${old.code} → ${fresh.code} — ${reason}`,
      },
    });
    return fresh;
  });
}
