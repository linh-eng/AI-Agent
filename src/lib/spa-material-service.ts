// =============================================================================
// Dịch vụ VẬT TƯ SPA — tiêu hao từ 2 nguồn, ghi lịch sử, cập nhật tồn còn lại +
// chi phí buổi. Tách khỏi Kho THNG.
//   * "Kho vật tư sử dụng" (container dùng chung): trừ remainingQty của lọ/lô,
//     phân bổ chi phí theo giá vốn lọ. Chặn dùng vượt tồn (trừ khi cho phép âm).
//   * "Vật tư khách hàng": chỉ dùng cho ĐÚNG khách sở hữu (chặn dùng chéo khách),
//     cộng usedQty, chặn vượt số đã cấp.
//   * Mỗi lần dùng ghi 1 MaterialUsage (lịch sử) + cập nhật session.materialCost.
// An toàn đồng thời: khóa dòng bằng SELECT … FOR UPDATE trong transaction.
// =============================================================================
import { prisma } from "./prisma";
import { INVENTORY_CONFIG } from "./config";
import { Prisma } from "@prisma/client";

export class MaterialError extends Error {
  status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "MaterialError";
  }
}

function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

interface ConsumeInput {
  sessionId?: string | null;
  performedBy?: string | null;
  quantity: number;
  note?: string | null;
  occurredAt?: Date;
}

/** Tiêu hao từ 1 CONTAINER (Kho vật tư sử dụng). */
export async function consumeFromContainer(containerId: string, input: ConsumeInput) {
  const qty = Number(input.quantity);
  if (!(qty > 0)) throw new MaterialError("Số lượng sử dụng phải lớn hơn 0.");

  return prisma.$transaction(async (tx) => {
    // Khóa dòng container để tránh dùng vượt khi đồng thời.
    const rows = await tx.$queryRaw<
      { id: string; remainingQty: Prisma.Decimal; initialQty: Prisma.Decimal; costSnapshot: Prisma.Decimal | null; unit: string; usageMaterialId: string; status: string }[]
    >`SELECT id, "remainingQty", "initialQty", "costSnapshot", unit, "usageMaterialId", status
        FROM material_containers WHERE id = ${containerId} FOR UPDATE`;
    const c = rows[0];
    if (!c) throw new MaterialError("Không tìm thấy lọ/lô vật tư.");
    if (c.status === "DISPOSED") throw new MaterialError("Lọ/lô đã hủy, không thể sử dụng.");

    const remaining = toNum(c.remainingQty);
    if (qty > remaining && !INVENTORY_CONFIG.allowNegativeStock) {
      throw new MaterialError(`Không đủ vật tư: còn ${remaining}, cần ${qty}.`);
    }
    const material = await tx.usageMaterial.findUnique({ where: { id: c.usageMaterialId } });

    // Chi phí phân bổ theo giá vốn lọ.
    const initial = toNum(c.initialQty);
    const unitCost = c.costSnapshot != null && initial > 0 ? toNum(c.costSnapshot) / initial : null;
    const costAllocated = unitCost != null ? Number((unitCost * qty).toFixed(2)) : null;

    const newRemaining = remaining - qty;
    const lowThreshold = toNum(material?.lowThreshold);
    const newStatus = newRemaining <= 0 ? "EMPTY" : lowThreshold > 0 && newRemaining <= lowThreshold ? "LOW" : "IN_USE";

    await tx.materialContainer.update({
      where: { id: containerId },
      data: {
        remainingQty: new Prisma.Decimal(newRemaining),
        status: newStatus as any,
        openedAt: undefined,
      },
    });

    // Lấy customerId từ buổi (không tin client).
    let customerId: string | null = null;
    if (input.sessionId) {
      const s = await tx.treatmentSession.findUnique({ where: { id: input.sessionId }, select: { customerId: true } });
      customerId = s?.customerId ?? null;
    }

    const usage = await tx.materialUsage.create({
      data: {
        source: "SHARED_STOCK",
        containerId,
        sessionId: input.sessionId ?? null,
        customerId,
        performedBy: input.performedBy ?? null,
        quantity: new Prisma.Decimal(qty),
        unitCost: unitCost != null ? new Prisma.Decimal(unitCost) : null,
        costAllocated: costAllocated != null ? new Prisma.Decimal(costAllocated) : null,
        serviceId: material?.serviceId ?? null,
        technologyId: material?.technologyId ?? null,
        brandProtocolId: material?.brandProtocolId ?? null,
        note: input.note ?? null,
        occurredAt: input.occurredAt ?? undefined,
      },
    });

    if (input.sessionId) await recomputeSessionMaterialCost(tx, input.sessionId);
    return usage;
  });
}

/** Tiêu hao từ VẬT TƯ KHÁCH HÀNG — chặn dùng chéo khách + vượt số đã cấp. */
export async function consumeFromCustomerMaterial(customerMaterialId: string, input: ConsumeInput) {
  const qty = Number(input.quantity);
  if (!(qty > 0)) throw new MaterialError("Số lượng sử dụng phải lớn hơn 0.");

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; allocatedQty: Prisma.Decimal; usedQty: Prisma.Decimal; unitCost: Prisma.Decimal | null; customerId: string; status: string }[]
    >`SELECT id, "allocatedQty", "usedQty", "unitCost", "customerId", status
        FROM customer_materials WHERE id = ${customerMaterialId} FOR UPDATE`;
    const m = rows[0];
    if (!m) throw new MaterialError("Không tìm thấy vật tư khách hàng.");
    if (m.status === "CANCELLED") throw new MaterialError("Vật tư khách hàng đã hủy.");

    // CHẶN dùng chéo khách: buổi phải thuộc đúng khách sở hữu vật tư.
    let sessionCustomerId: string | null = null;
    if (input.sessionId) {
      const s = await tx.treatmentSession.findUnique({ where: { id: input.sessionId }, select: { customerId: true } });
      sessionCustomerId = s?.customerId ?? null;
      if (sessionCustomerId && sessionCustomerId !== m.customerId) {
        throw new MaterialError("Vật tư này thuộc khách khác — không được dùng cho khách hiện tại.");
      }
    }

    const allocated = toNum(m.allocatedQty);
    const used = toNum(m.usedQty);
    if (used + qty > allocated) {
      throw new MaterialError(`Vượt số đã cấp: còn ${allocated - used}, cần ${qty}.`);
    }
    const unitCost = m.unitCost != null ? toNum(m.unitCost) : null;
    const costAllocated = unitCost != null ? Number((unitCost * qty).toFixed(2)) : null;
    const newUsed = used + qty;

    await tx.customerMaterial.update({
      where: { id: customerMaterialId },
      data: {
        usedQty: new Prisma.Decimal(newUsed),
        status: newUsed >= allocated ? "USED_UP" : "ACTIVE",
      },
    });

    const usage = await tx.materialUsage.create({
      data: {
        source: "CUSTOMER_OWNED",
        customerMaterialId,
        sessionId: input.sessionId ?? null,
        customerId: m.customerId,
        performedBy: input.performedBy ?? null,
        quantity: new Prisma.Decimal(qty),
        unitCost: unitCost != null ? new Prisma.Decimal(unitCost) : null,
        costAllocated: costAllocated != null ? new Prisma.Decimal(costAllocated) : null,
        note: input.note ?? null,
        occurredAt: input.occurredAt ?? undefined,
      },
    });

    if (input.sessionId) await recomputeSessionMaterialCost(tx, input.sessionId);
    return usage;
  });
}

/** Tính lại chi phí vật tư của buổi = tổng costAllocated các lần dùng; gán actualCost nếu trống. */
export async function recomputeSessionMaterialCost(
  tx: Prisma.TransactionClient | typeof prisma,
  sessionId: string
): Promise<number> {
  const agg = await tx.materialUsage.aggregate({
    where: { sessionId },
    _sum: { costAllocated: true },
  });
  const total = toNum(agg._sum.costAllocated);
  const session = await tx.treatmentSession.findUnique({ where: { id: sessionId }, select: { actualCost: true } });
  await tx.treatmentSession.update({
    where: { id: sessionId },
    data: {
      materialCost: new Prisma.Decimal(total),
      // Tiêu hao đóng góp chi phí thật: nếu chưa nhập actualCost thì gán bằng chi phí vật tư.
      ...(session && session.actualCost == null ? { actualCost: new Prisma.Decimal(total) } : {}),
    },
  });
  return total;
}

/** Hủy 1 lần dùng (hoàn tác) — cộng lại tồn/def used, ghi âm không giữ; dùng cho sửa nhầm. */
export async function reverseUsage(usageId: string) {
  return prisma.$transaction(async (tx) => {
    const u = await tx.materialUsage.findUnique({ where: { id: usageId } });
    if (!u) throw new MaterialError("Không tìm thấy lần sử dụng.");
    const qty = toNum(u.quantity);
    if (u.source === "SHARED_STOCK" && u.containerId) {
      const c = await tx.materialContainer.findUnique({ where: { id: u.containerId } });
      if (c) {
        const newRem = toNum(c.remainingQty) + qty;
        await tx.materialContainer.update({ where: { id: c.id }, data: { remainingQty: new Prisma.Decimal(newRem), status: c.status === "DISPOSED" ? "DISPOSED" : newRem > 0 ? "IN_USE" : "EMPTY" } });
      }
    } else if (u.source === "CUSTOMER_OWNED" && u.customerMaterialId) {
      const m = await tx.customerMaterial.findUnique({ where: { id: u.customerMaterialId } });
      if (m) {
        const newUsed = Math.max(0, toNum(m.usedQty) - qty);
        await tx.customerMaterial.update({ where: { id: m.id }, data: { usedQty: new Prisma.Decimal(newUsed), status: newUsed >= toNum(m.allocatedQty) ? "USED_UP" : "ACTIVE" } });
      }
    }
    await tx.materialUsage.delete({ where: { id: usageId } });
    if (u.sessionId) await recomputeSessionMaterialCost(tx, u.sessionId);
    return { id: usageId, reversed: true };
  });
}
