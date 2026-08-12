// =============================================================================
// Module 8 — Dịch vụ vật tư buổi ↔ tồn kho THỰC.
//
// Nguyên tắc:
//  * StockMovement là NGUỒN SỰ THẬT (ledger bất biến) cho mọi thay đổi tồn vật lý.
//  * Lot.quantity = tồn vật lý; Lot.reservedQty = số đang giữ; khả dụng = quantity - reservedQty.
//  * Vòng đời: REQUEST → RESERVE (giữ) → ISSUE (xuất, trừ tồn) → CONSUME/WASTE/DAMAGE
//    (định đoạt phần đã xuất) → RETURN (trả lại kho, cộng tồn).
//  * Kiểm tra khả dụng TRƯỚC khi RESERVE/ISSUE; chặn tồn âm trừ khi cấu hình cho phép.
//  * Đồng thời-an toàn: khóa dòng Lot bằng SELECT ... FOR UPDATE trong transaction.
//  * Mỗi biến động lưu snapshot giá vốn; CONSUME đóng góp chi phí thật của buổi.
//  * Vật tư KHÔNG gắn Lot (SP chuyên nghiệp không theo kho) chỉ tính chi phí (không trừ tồn).
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { INVENTORY_CONFIG, InsufficientStockError } from "./config";

type MoveType = "REQUEST" | "RESERVE" | "ISSUE" | "CONSUME" | "RETURN" | "WASTE" | "DAMAGE";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface MoveInput {
  type: MoveType;
  quantity: number;
  warehouseId?: string | null;
  staff?: string | null;
  note?: string | null;
  allowNegative?: boolean; // ghi đè cấu hình cho lần xuất này (cần quyền)
}

/**
 * Ghi một biến động vật tư, cập nhật bucket SessionMaterial, và (nếu có Lot) trừ/cộng
 * tồn kho thật + ghi StockMovement — tất cả trong MỘT transaction có khóa dòng Lot.
 */
export async function applyMaterialMovement(sessionMaterialId: string, input: MoveInput) {
  const qty = input.quantity;
  if (!(qty > 0)) throw new Error("Số lượng phải > 0");
  const allowNegative = input.allowNegative ?? INVENTORY_CONFIG.allowNegativeStock;

  await prisma.$transaction(async (tx) => {
    const sm = await tx.sessionMaterial.findUnique({
      where: { id: sessionMaterialId },
      include: { session: { select: { id: true, customerId: true, bookingId: true } } },
    });
    if (!sm) throw new Error("Không tìm thấy dòng vật tư");

    const outstanding = num(sm.issuedQty) - num(sm.consumedQty) - num(sm.wasteQty) - num(sm.returnedQty);

    // ---- Cập nhật tồn kho thật khi có Lot ----
    let stockMovementId: string | null = null;
    let warehouseId = input.warehouseId ?? sm.warehouseId ?? null;

    if (sm.lotId && ["RESERVE", "ISSUE", "RETURN"].includes(input.type)) {
      // Khóa dòng lot để tránh oversell khi nhiều người thao tác đồng thời.
      const locked = await tx.$queryRaw<{ quantity: number; reservedQty: number; warehouseId: string }[]>(
        Prisma.sql`SELECT "quantity", "reservedQty", "warehouseId" FROM "lots" WHERE "id" = ${sm.lotId} FOR UPDATE`
      );
      if (!locked.length) throw new Error("Không tìm thấy lô kho");
      const lot = locked[0];
      warehouseId = lot.warehouseId;
      const available = lot.quantity - lot.reservedQty;

      if (input.type === "RESERVE") {
        if (!allowNegative && qty > available) {
          throw new InsufficientStockError(`Không đủ tồn để giữ: khả dụng ${available}, cần ${qty}`);
        }
        await tx.lot.update({ where: { id: sm.lotId }, data: { reservedQty: { increment: qty } } });
      } else if (input.type === "ISSUE") {
        if (!allowNegative && qty > lot.quantity) {
          throw new InsufficientStockError(`Không đủ tồn để xuất: tồn ${lot.quantity}, cần ${qty}`);
        }
        const releaseHold = Math.min(qty, lot.reservedQty);
        await tx.lot.update({
          where: { id: sm.lotId },
          data: { quantity: { decrement: qty }, reservedQty: { decrement: releaseHold } },
        });
        const mv = await tx.stockMovement.create({
          data: {
            type: "OUTBOUND",
            lotId: sm.lotId,
            quantity: Math.round(qty),
            fromWarehouseId: lot.warehouseId,
            documentType: "SESSION_MATERIAL",
            documentNumber: sm.id,
            note: `Xuất vật tư buổi (session ${sm.sessionId})`,
            createdBy: input.staff ?? null,
          },
        });
        stockMovementId = mv.id;
      } else if (input.type === "RETURN") {
        if (qty > outstanding) {
          throw new InsufficientStockError(`Chỉ có thể hoàn tối đa ${outstanding} (đã xuất chưa dùng)`);
        }
        await tx.lot.update({ where: { id: sm.lotId }, data: { quantity: { increment: qty } } });
        const mv = await tx.stockMovement.create({
          data: {
            type: "INBOUND",
            lotId: sm.lotId,
            quantity: Math.round(qty),
            toWarehouseId: lot.warehouseId,
            documentType: "SESSION_MATERIAL_RETURN",
            documentNumber: sm.id,
            note: `Hoàn vật tư buổi (session ${sm.sessionId})`,
            createdBy: input.staff ?? null,
          },
        });
        stockMovementId = mv.id;
      }
    }

    // CONSUME/WASTE/DAMAGE với Lot: không trừ tồn lần nữa (đã trừ ở ISSUE) nhưng
    // không được vượt phần đang cầm (issued chưa định đoạt).
    if (sm.lotId && ["CONSUME", "WASTE", "DAMAGE"].includes(input.type) && qty > outstanding) {
      throw new InsufficientStockError(`Chỉ có thể ${input.type} tối đa ${outstanding} (đã xuất chưa định đoạt)`);
    }

    // ---- Cập nhật bucket SessionMaterial ----
    const inc: Record<string, { increment: number }> = {};
    switch (input.type) {
      case "RESERVE": inc.reservedQty = { increment: qty }; break;
      case "ISSUE":
        inc.issuedQty = { increment: qty };
        if (num(sm.reservedQty) > 0) {
          const release = Math.min(qty, num(sm.reservedQty));
          await tx.sessionMaterial.update({ where: { id: sm.id }, data: { reservedQty: { decrement: release } } });
        }
        break;
      case "CONSUME": inc.consumedQty = { increment: qty }; break;
      case "RETURN": inc.returnedQty = { increment: qty }; break;
      case "WASTE":
      case "DAMAGE": inc.wasteQty = { increment: qty }; break;
      case "REQUEST": break;
    }
    if (Object.keys(inc).length) {
      await tx.sessionMaterial.update({ where: { id: sm.id }, data: inc });
    }

    // ---- Ledger spa (giữ snapshot giá vốn + liên kết StockMovement) ----
    await tx.materialMovement.create({
      data: {
        sessionMaterialId,
        type: input.type,
        quantity: qty,
        unitCost: sm.unitCost ?? null,
        warehouseId,
        lotId: sm.lotId ?? null,
        stockMovementId,
        bookingId: sm.session.bookingId ?? null,
        customerId: sm.session.customerId ?? null,
        staff: input.staff ?? null,
        note: input.note ?? null,
      },
    });

    // ---- Chi phí buổi ----
    if (input.type === "CONSUME") {
      await recomputeSessionMaterialCostTx(tx, sm.session.id);
    }
  });

  return prisma.sessionMaterial.findUnique({
    where: { id: sessionMaterialId },
    include: { movements: { orderBy: { createdAt: "desc" } } },
  });
}

async function recomputeSessionMaterialCostTx(tx: Prisma.TransactionClient, sessionId: string): Promise<number> {
  const mats = await tx.sessionMaterial.findMany({
    where: { sessionId },
    select: { consumedQty: true, unitCost: true },
  });
  const materialCost = mats.reduce((s, m) => s + num(m.consumedQty) * num(m.unitCost), 0);
  const session = await tx.treatmentSession.findUnique({ where: { id: sessionId }, select: { actualCost: true } });
  const data: Record<string, unknown> = { materialCost };
  if (session && (session.actualCost === null || session.actualCost === undefined)) {
    data.actualCost = materialCost;
  }
  await tx.treatmentSession.update({ where: { id: sessionId }, data });
  return materialCost;
}

/** Tính lại chi phí vật tư buổi (dùng ngoài transaction, ví dụ sau khi xóa dòng). */
export async function recomputeSessionMaterialCost(sessionId: string): Promise<number> {
  return prisma.$transaction((tx) => recomputeSessionMaterialCostTx(tx, sessionId));
}
