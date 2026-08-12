// =============================================================================
// Nghiệp vụ xuất kho: tạo phiếu xuất, phân bổ lô theo FEFO (hết hạn trước xuất
// trước), trừ tồn + ghi biến động. Chặn xuất vượt tồn khả dụng.
// Sửa/hủy phiếu đã ghi sổ: hủy = hoàn tồn về đúng lô đã xuất + đánh dấu
// CANCELLED; sửa = hủy phiếu cũ rồi tạo phiếu mới (có lý do). Phiếu xuất do ghi
// nhận dịch vụ sinh ra (ServiceUsage) không cho hủy trực tiếp tại đây.
// =============================================================================
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { nextIssueCode } from "./codes";
import type { IssueCreateInput } from "./validation";

type Tx = Prisma.TransactionClient;

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

/** Ghi sổ 1 phiếu xuất trong transaction đang mở. Trả về id + code. */
async function postIssueTx(
  tx: Tx,
  input: IssueCreateInput,
  userId: string,
  note?: string | null
) {
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const code = await nextIssueCode();
  const issue = await tx.goodsIssue.create({
    data: {
      code,
      warehouseId: input.warehouseId,
      issueType: input.issueType,
      customerName: input.customerName,
      status: "POSTED",
      note: note ?? input.note,
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
}

export async function createIssue(input: IssueCreateInput, userId: string) {
  return prisma.$transaction((tx) => postIssueTx(tx, input, userId));
}

/** Phiếu xuất do ghi nhận dịch vụ tạo ra thì không cho hủy/sửa trực tiếp. */
async function assertNotServiceIssue(id: string) {
  const usage = await prisma.serviceUsage.findFirst({ where: { issueId: id } });
  if (usage)
    throw new HttpError(
      400,
      `Phiếu xuất này phát sinh từ ghi nhận dịch vụ (${usage.code}) — hãy điều chỉnh ở phần ghi nhận dịch vụ, không sửa/hủy trực tiếp.`
    );
}

/**
 * Đảo bút toán của 1 phiếu xuất: cộng lại đúng lô đã xuất + ghi biến động dương.
 * Cộng lại luôn an toàn (không đẩy âm) nên không cần chặn tồn. Dùng chung hủy/sửa.
 */
async function reverseIssueTx(
  tx: Tx,
  issueId: string,
  reason: string,
  refCode: string,
  label: string
) {
  const items = await tx.goodsIssueItem.findMany({ where: { issueId } });
  for (const it of items) {
    if (!it.batchId) continue;
    const batch = await tx.stockBatch.update({
      where: { id: it.batchId },
      data: { quantity: { increment: it.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: it.productId,
        warehouseId: batch.warehouseId,
        batchId: it.batchId,
        type: "ADJUSTMENT",
        quantity: it.quantity,
        refType: "ISSUE_CANCEL",
        refId: issueId,
        refCode,
        note: `${label}: ${reason}`,
      },
    });
  }
}

/** Hủy phiếu xuất đã ghi sổ: hoàn tồn về lô đã xuất + đánh dấu CANCELLED. */
export async function cancelIssue(id: string, reason: string, userId: string) {
  const issue = await prisma.goodsIssue.findUnique({ where: { id } });
  if (!issue) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (issue.status === "CANCELLED")
    throw new HttpError(400, "Phiếu xuất đã bị hủy trước đó");
  await assertNotServiceIssue(id);

  return prisma.$transaction(async (tx) => {
    await reverseIssueTx(tx, id, reason, issue.code, "Hủy phiếu xuất");
    await tx.goodsIssue.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "ISSUE_CANCEL",
        entityType: "GoodsIssue",
        entityId: id,
        detail: `${issue.code} — ${reason}`,
      },
    });
    return { id, code: issue.code };
  });
}

/**
 * Sửa phiếu xuất đã ghi sổ = hủy phiếu cũ (hoàn tồn) + tạo phiếu mới (phân bổ
 * FEFO lại) trong 1 transaction. Trả về phiếu mới. Giữ phiếu cũ để tra cứu.
 */
export async function updateIssue(
  id: string,
  input: IssueCreateInput,
  reason: string,
  userId: string
) {
  const old = await prisma.goodsIssue.findUnique({ where: { id } });
  if (!old) throw new HttpError(404, "Không tìm thấy phiếu xuất");
  if (old.status === "CANCELLED")
    throw new HttpError(400, "Phiếu xuất đã bị hủy — không thể sửa");
  await assertNotServiceIssue(id);

  return prisma.$transaction(async (tx) => {
    await reverseIssueTx(tx, id, reason, old.code, "Sửa phiếu xuất");
    const fresh = await postIssueTx(
      tx,
      input,
      userId,
      input.note ? `${input.note} (sửa từ ${old.code})` : `Sửa từ ${old.code}`
    );
    await tx.goodsIssue.update({
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
        action: "ISSUE_EDIT",
        entityType: "GoodsIssue",
        entityId: id,
        detail: `${old.code} → ${fresh.code} — ${reason}`,
      },
    });
    return fresh;
  });
}
