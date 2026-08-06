// =============================================================================
// Dịch vụ RÃ MÁY (M10)
//   đề nghị rã (+ lý do) -> DUYỆT BGĐ (bắt buộc) -> thực hiện: đối chiếu
//   as-built BOM, serial cha -> DISASSEMBLED, nhập lại serial con tình trạng
//   "Tháo máy" + grade vào K-TMAY (giữ hạn BH hãng còn lại); con hỏng -> K-TL.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./session";
import type { z } from "zod";
import type { disassemblyCreateSchema, disassemblyExecuteSchema } from "./validation";

type CreateInput = z.infer<typeof disassemblyCreateSchema>;
type ExecuteInput = z.infer<typeof disassemblyExecuteSchema>;

async function nextNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const p = `RA-${year}-`;
  const count = await tx.disassemblyOrder.count({ where: { number: { startsWith: p } } });
  return `${p}${String(count + 1).padStart(4, "0")}`;
}

/** Đề nghị rã máy. */
export async function createDisassembly(input: CreateInput, userId: string) {
  const parent = await prisma.serial.findUnique({ where: { serialNumber: input.parentSerialNumber } });
  if (!parent) throw new HttpError(422, `Serial ${input.parentSerialNumber} không tồn tại`);
  if (parent.status === "DISASSEMBLED") throw new HttpError(409, "Máy đã được rã");

  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx);
    const order = await tx.disassemblyOrder.create({
      data: { number, parentSerialId: parent.id, reason: input.reason ?? null, status: "DRAFT" },
    });
    await tx.auditLog.create({ data: { userId, action: "CREATE", entityType: "DisassemblyOrder", entityId: order.id } });
    return order;
  });
}

/** Duyệt rã máy (BGĐ/quản lý — bắt buộc). */
export async function approveDisassembly(orderId: string, userId: string) {
  const order = await prisma.disassemblyOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Không tìm thấy lệnh rã máy");
  if (order.status !== "DRAFT" && order.status !== "PENDING_APPROVAL") {
    throw new HttpError(409, "Trạng thái không cho phép duyệt");
  }
  const updated = await prisma.disassemblyOrder.update({
    where: { id: orderId },
    data: { status: "APPROVED", approvedBy: userId, approvedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { userId, action: "APPROVE", entityType: "DisassemblyOrder", entityId: orderId } });
  return updated;
}

/**
 * Thực hiện rã: đối chiếu as-built BOM (version mới nhất), serial cha ->
 * DISASSEMBLED; serial con tách khỏi máy, nhập K-TMAY (grade) hoặc K-TL (scrap).
 */
export async function executeDisassembly(orderId: string, input: ExecuteInput, userId: string) {
  const order = await prisma.disassemblyOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Không tìm thấy lệnh rã máy");
  if (order.status !== "APPROVED") throw new HttpError(409, "Lệnh rã máy chưa được duyệt");
  if (order.executedAt) throw new HttpError(409, "Lệnh đã thực hiện");

  const tmay = (await prisma.warehouse.findUniqueOrThrow({ where: { code: "K-TMAY" } })).id;
  const tl = (await prisma.warehouse.findUniqueOrThrow({ where: { code: "K-TL" } })).id;

  // As-built version mới nhất
  const bom = await prisma.bomAsBuilt.findMany({
    where: { parentSerialId: order.parentSerialId },
    include: { childSerial: true },
  });
  const maxVersion = bom.length ? Math.max(...bom.map((b) => b.version)) : 0;
  const latestChildren = bom.filter((b) => b.version === maxVersion && b.childSerialId);

  const gradeBySn = new Map(input.children.map((c) => [c.serialNumber, c]));

  return prisma.$transaction(async (tx) => {
    // Serial cha -> DISASSEMBLED
    await tx.serial.update({ where: { id: order.parentSerialId }, data: { status: "DISASSEMBLED" } });
    await tx.serialEvent.create({ data: { serialId: order.parentSerialId, eventType: "DISASSEMBLE", toStatus: "DISASSEMBLED", detail: { order: order.number }, createdBy: userId } });

    const recovered: string[] = [];
    const scrapped: string[] = [];

    for (const b of latestChildren) {
      const child = b.childSerial!;
      const opt = gradeBySn.get(child.serialNumber);
      const scrap = opt?.scrap ?? false;
      const toWh = scrap ? tl : tmay;
      await tx.serial.update({
        where: { id: child.id },
        data: {
          parentSerialId: null,
          warehouseId: toWh,
          status: scrap ? "SCRAPPED" : "IN_STOCK",
          condition: scrap ? "Hỏng — chờ hủy" : "Tháo máy",
          grade: scrap ? null : (opt?.grade ?? "B"),
        },
      });
      await tx.stockMovement.create({
        data: { type: "DISASSEMBLY", serialId: child.id, toWarehouseId: toWh, documentType: "DISASSEMBLY", documentNumber: order.number, note: scrap ? "Rã máy - linh kiện hỏng -> K-TL" : "Rã máy - thu hồi linh kiện -> K-TMAY", createdBy: userId },
      });
      await tx.serialEvent.create({
        data: { serialId: child.id, eventType: "DISASSEMBLED_PART", toStatus: scrap ? "SCRAPPED" : "IN_STOCK", detail: { order: order.number, grade: opt?.grade ?? "B" }, createdBy: userId },
      });
      (scrap ? scrapped : recovered).push(child.serialNumber);
    }

    const updated = await tx.disassemblyOrder.update({ where: { id: order.id }, data: { executedAt: new Date() } });
    await tx.auditLog.create({ data: { userId, action: "EXECUTE", entityType: "DisassemblyOrder", entityId: order.id, changes: { recovered: recovered.length, scrapped: scrapped.length } } });
    return { order: updated, recovered, scrapped };
  });
}
