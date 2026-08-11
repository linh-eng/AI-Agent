// =============================================================================
// Module 8 — Dịch vụ vật tư buổi: áp dụng movement + cập nhật bucket + tính chi phí.
// Tiêu hao (CONSUME) đóng góp vào chi phí thật của buổi (materialCost).
// =============================================================================
import { prisma } from "./prisma";

type MoveType = "REQUEST" | "RESERVE" | "ISSUE" | "CONSUME" | "RETURN" | "WASTE" | "DAMAGE";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

/**
 * Ghi một biến động vật tư cho 1 dòng SessionMaterial, cập nhật bucket tương ứng,
 * lưu snapshot giá vốn, và (nếu CONSUME) tính lại chi phí vật tư của buổi.
 */
export async function applyMaterialMovement(
  sessionMaterialId: string,
  input: { type: MoveType; quantity: number; warehouseId?: string | null; staff?: string | null; note?: string | null }
) {
  const sm = await prisma.sessionMaterial.findUnique({
    where: { id: sessionMaterialId },
    include: { session: { select: { id: true, customerId: true, bookingId: true } } },
  });
  if (!sm) throw new Error("Không tìm thấy dòng vật tư");

  const qty = input.quantity;
  const inc: Record<string, { increment: number }> = {};
  switch (input.type) {
    case "RESERVE": inc.reservedQty = { increment: qty }; break;
    case "ISSUE": inc.issuedQty = { increment: qty }; break;
    case "CONSUME": inc.consumedQty = { increment: qty }; break;
    case "RETURN": inc.returnedQty = { increment: qty }; break;
    case "WASTE":
    case "DAMAGE": inc.wasteQty = { increment: qty }; break;
    case "REQUEST": break; // chỉ ghi nhận yêu cầu
  }

  await prisma.$transaction(async (tx) => {
    await tx.materialMovement.create({
      data: {
        sessionMaterialId,
        type: input.type,
        quantity: qty,
        unitCost: sm.unitCost ?? null,
        warehouseId: input.warehouseId ?? sm.warehouseId ?? null,
        bookingId: sm.session.bookingId ?? null,
        customerId: sm.session.customerId ?? null,
        staff: input.staff ?? null,
        note: input.note ?? null,
      },
    });
    if (Object.keys(inc).length) {
      await tx.sessionMaterial.update({ where: { id: sessionMaterialId }, data: inc });
    }
  });

  if (input.type === "CONSUME") {
    await recomputeSessionMaterialCost(sm.session.id);
  }
  return prisma.sessionMaterial.findUnique({ where: { id: sessionMaterialId }, include: { movements: { orderBy: { createdAt: "desc" } } } });
}

/**
 * Tính lại chi phí vật tư buổi = Σ(consumedQty × unitCost). Ghi vào session.materialCost;
 * nếu actualCost đang trống thì gán = materialCost (để đóng góp vào chi phí thật).
 */
export async function recomputeSessionMaterialCost(sessionId: string): Promise<number> {
  const mats = await prisma.sessionMaterial.findMany({
    where: { sessionId },
    select: { consumedQty: true, unitCost: true },
  });
  const materialCost = mats.reduce((s, m) => s + num(m.consumedQty) * num(m.unitCost), 0);
  const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId }, select: { actualCost: true } });
  const data: Record<string, unknown> = { materialCost };
  if (session && (session.actualCost === null || session.actualCost === undefined)) {
    data.actualCost = materialCost;
  }
  await prisma.treatmentSession.update({ where: { id: sessionId }, data });
  return materialCost;
}
