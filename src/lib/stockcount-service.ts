// =============================================================================
// Dịch vụ KIỂM KÊ (M5) — quét thực tế -> tự so lệch -> duyệt BGĐ -> bút toán
// điều chỉnh (stock_movement ADJUSTMENT). Không xóa serial; chỉ ghi chênh lệch.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";

async function nextCountNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `KK-${year}-`;
  const count = await tx.stockCount.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/** Tạo phiếu kiểm kê + chụp danh sách serial hệ thống kỳ vọng trong kho. */
export async function createStockCount(warehouseId: string, note: string | null, userId: string) {
  const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!wh) throw new HttpError(422, "Không tìm thấy kho");

  const expected = await prisma.serial.findMany({
    where: { warehouseId, parentSerialId: null, status: "IN_STOCK" },
    select: { id: true, serialNumber: true },
  });

  return prisma.$transaction(async (tx) => {
    const number = await nextCountNumber(tx);
    const count = await tx.stockCount.create({
      data: {
        number,
        warehouseId,
        status: "DRAFT",
        note,
        lines: {
          create: expected.map((s) => ({
            serialId: s.id,
            serialNumber: s.serialNumber,
            expected: true,
            scanned: false,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.auditLog.create({
      data: { userId, action: "CREATE", entityType: "StockCount", entityId: count.id },
    });
    return count;
  });
}

/** Ghi nhận serial quét thực tế. Serial lạ (không kỳ vọng) tạo dòng extra. */
export async function scanStockCount(countId: string, serialNumbers: string[], userId: string) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId },
    include: { lines: true },
  });
  if (!count) throw new HttpError(404, "Không tìm thấy phiếu kiểm kê");
  if (count.status === "APPROVED" || count.status === "CANCELLED") {
    throw new HttpError(409, "Phiếu đã kết thúc");
  }
  const lineBySn = new Map(count.lines.map((l) => [l.serialNumber, l]));

  await prisma.$transaction(async (tx) => {
    for (const sn of serialNumbers) {
      const line = lineBySn.get(sn);
      if (line) {
        if (!line.scanned) {
          await tx.stockCountLine.update({ where: { id: line.id }, data: { scanned: true } });
        }
      } else {
        // serial lạ: có thể ở kho khác hoặc chưa ghi nhận
        const serial = await tx.serial.findUnique({ where: { serialNumber: sn } });
        const created = await tx.stockCountLine.create({
          data: {
            stockCountId: count.id,
            serialId: serial?.id ?? null,
            serialNumber: sn,
            expected: false,
            scanned: true,
            note: serial ? "Serial thuộc kho/khác vị trí" : "Serial lạ chưa có trong hệ thống",
          },
        });
        lineBySn.set(sn, created as any);
      }
    }
    if (count.status === "DRAFT") {
      await tx.stockCount.update({ where: { id: count.id }, data: { status: "COUNTING" } });
    }
  });

  return prisma.stockCount.findUnique({ where: { id: countId }, include: { lines: true } });
}

/** Chốt kiểm kê để trình duyệt. */
export async function submitStockCount(countId: string) {
  const count = await prisma.stockCount.findUnique({ where: { id: countId } });
  if (!count) throw new HttpError(404, "Không tìm thấy phiếu kiểm kê");
  if (count.status !== "COUNTING" && count.status !== "DRAFT") {
    throw new HttpError(409, "Trạng thái không cho phép trình duyệt");
  }
  return prisma.stockCount.update({
    where: { id: countId },
    data: { status: "PENDING_APPROVAL" },
  });
}

/**
 * Duyệt (BGĐ): sinh bút toán điều chỉnh cho từng chênh lệch.
 *   - Thiếu (kỳ vọng có, không quét thấy): ADJUSTMENT rời kho.
 *   - Thừa (quét thấy, không kỳ vọng): ADJUSTMENT nhập kho.
 */
export async function approveStockCount(countId: string, userId: string) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId },
    include: { lines: true },
  });
  if (!count) throw new HttpError(404, "Không tìm thấy phiếu kiểm kê");
  if (count.status !== "PENDING_APPROVAL") {
    throw new HttpError(409, "Phiếu chưa ở trạng thái chờ duyệt");
  }

  const missing = count.lines.filter((l) => l.expected && !l.scanned);
  const extra = count.lines.filter((l) => !l.expected && l.scanned);

  return prisma.$transaction(async (tx) => {
    for (const l of missing) {
      await tx.stockMovement.create({
        data: {
          type: "ADJUSTMENT",
          serialId: l.serialId,
          fromWarehouseId: count.warehouseId,
          documentType: "STOCK_COUNT",
          documentNumber: count.number,
          note: `Kiểm kê thiếu: ${l.serialNumber}`,
          createdBy: userId,
        },
      });
    }
    for (const l of extra) {
      await tx.stockMovement.create({
        data: {
          type: "ADJUSTMENT",
          serialId: l.serialId,
          toWarehouseId: count.warehouseId,
          documentType: "STOCK_COUNT",
          documentNumber: count.number,
          note: `Kiểm kê thừa: ${l.serialNumber}`,
          createdBy: userId,
        },
      });
    }
    const updated = await tx.stockCount.update({
      where: { id: count.id },
      data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "APPROVE",
        entityType: "StockCount",
        entityId: count.id,
        changes: { missing: missing.length, extra: extra.length },
      },
    });
    return { count: updated, missing: missing.length, extra: extra.length };
  });
}
