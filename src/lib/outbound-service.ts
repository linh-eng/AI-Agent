// =============================================================================
// Nghiệp vụ xuất kho: tạo phiếu xuất, phân bổ lô theo FEFO (hết hạn trước xuất
// trước), trừ tồn + ghi biến động. Chặn xuất vượt tồn khả dụng.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextIssueCode } from "./codes";
import type { IssueCreateInput } from "./validation";

interface Allocation {
  batchId: string;
  quantity: number;
}

/**
 * Chọn lô để xuất theo FEFO: HSD sớm nhất trước (lô không HSD xếp sau),
 * cùng HSD thì lô cũ (createdAt) trước. Nếu chỉ định batchId thì dùng đúng lô đó.
 */
function allocateFefo(
  batches: { id: string; quantity: number; expiryDate: Date | null; createdAt: Date }[],
  need: number,
  pinnedBatchId?: string | null
): Allocation[] {
  const pool = pinnedBatchId
    ? batches.filter((b) => b.id === pinnedBatchId)
    : [...batches].sort((a, b) => {
        const ax = a.expiryDate ? a.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bx = b.expiryDate ? b.expiryDate.getTime() : Number.MAX_SAFE_INTEGER;
        if (ax !== bx) return ax - bx;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

  const out: Allocation[] = [];
  let remaining = need;
  for (const b of pool) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    if (take > 0) {
      out.push({ batchId: b.id, quantity: take });
      remaining -= take;
    }
  }
  if (remaining > 1e-9) return []; // không đủ tồn
  return out;
}

export async function createIssue(input: IssueCreateInput, userId: string) {
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const code = await nextIssueCode();

  return prisma.$transaction(async (tx) => {
    const issue = await tx.goodsIssue.create({
      data: {
        code,
        warehouseId: input.warehouseId,
        issueType: input.issueType,
        customerName: input.customerName,
        status: "POSTED",
        note: input.note,
        createdById: userId,
        issuedAt: new Date(),
      },
    });

    for (const item of input.items) {
      const p = byId.get(item.productId);
      if (!p) throw new HttpError(400, `Sản phẩm không tồn tại: ${item.productId}`);

      const batches = await tx.stockBatch.findMany({
        where: {
          productId: item.productId,
          warehouseId: input.warehouseId,
          quantity: { gt: 0 },
        },
      });
      const available = batches.reduce((s, b) => s + b.quantity, 0);
      if (available < item.quantity)
        throw new HttpError(
          400,
          `"${p.name}" không đủ tồn (cần ${item.quantity} ${p.uom}, còn ${available})`
        );

      const allocations = allocateFefo(batches, item.quantity, item.batchId);
      if (allocations.length === 0)
        throw new HttpError(
          400,
          `"${p.name}" không đủ tồn ở lô đã chọn cho ${item.quantity} ${p.uom}`
        );

      for (const alloc of allocations) {
        await tx.goodsIssueItem.create({
          data: {
            issueId: issue.id,
            productId: item.productId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          },
        });
        await tx.stockBatch.update({
          where: { id: alloc.batchId },
          data: { quantity: { decrement: alloc.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: input.warehouseId,
            batchId: alloc.batchId,
            type: "OUTBOUND",
            quantity: -alloc.quantity,
            refType: "ISSUE",
            refId: issue.id,
            refCode: issue.code,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "ISSUE_POST",
        entityType: "GoodsIssue",
        entityId: issue.id,
        detail: issue.code,
      },
    });

    return { id: issue.id, code: issue.code };
  });
}
