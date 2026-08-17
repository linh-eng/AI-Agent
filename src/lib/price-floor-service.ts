// =============================================================================
// GIÁ SÀN v2 (mục 7) — service tạo/sửa/duyệt/áp dụng VERSION giá sàn.
//  * Cost breakdown theo dòng → tổng giá vốn → giá sàn (margin) → chiết khấu tối đa.
//  * Version bất biến sau khi ACTIVE; snapshot cost + giá chuẩn tại thời điểm.
//  * Vòng đời: DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE → EXPIRED/CANCELLED.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { computeVersionCost, computeFloorPrice, maxDiscount, buildDefaultLinesFromService } from "./price-floor";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export class FloorError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

/** Tính lại toàn bộ version từ các dòng chi phí + cập nhật snapshot tổng. Chỉ dùng khi DRAFT/PENDING. */
export async function recomputeVersion(versionId: string, tx: Prisma.TransactionClient = prisma) {
  const v = await tx.servicePriceFloorVersion.findUnique({ where: { id: versionId }, include: { lines: { orderBy: { orderIndex: "asc" } }, service: { select: { standardPrice: true, durationMinutes: true } } } });
  if (!v) throw new FloorError("Không tìm thấy version giá sàn", 404);

  // PH2 — version tạo TỪ Costing: totalCost là SNAPSHOT từ ServiceCostingVersion,
  // KHÔNG tính lại từ cost lines (không có lines editable). Chỉ tính lại floorPrice
  // theo tổng đã snapshot + biên (MARGIN). Snapshot cost giữ bất biến.
  if (v.serviceCostingVersionId) {
    const total = num(v.totalCost);
    const floorPrice = computeFloorPrice({ totalCost: total, method: v.method, minMarginPercent: num(v.minMarginPercent), manualFloorPrice: v.manualFloorPrice == null ? null : num(v.manualFloorPrice), roundingUnit: v.roundingUnit });
    const standard = num(v.service.standardPrice);
    const md = maxDiscount(standard, floorPrice);
    return tx.servicePriceFloorVersion.update({
      where: { id: versionId },
      data: { standardPriceSnapshot: standard, floorPrice, maxDiscount: md.amount, maxDiscountPercent: md.percent },
      include: { lines: { orderBy: { orderIndex: "asc" } } },
    });
  }

  const minutes = v.durationMinutes ?? v.service.durationMinutes ?? 0;
  const cost = computeVersionCost(
    v.lines.map((l) => ({ category: l.category, quantity: num(l.quantity), unitCost: num(l.unitCost), calcType: l.calcType, calcValue: l.calcValue == null ? null : num(l.calcValue), minutes: l.minutes })),
    minutes
  );
  // Ghi lại amount từng dòng.
  for (let i = 0; i < v.lines.length; i++) {
    await tx.priceFloorCostLine.update({ where: { id: v.lines[i].id }, data: { amount: cost.lineAmounts[i] } });
  }
  const floorPrice = computeFloorPrice({ totalCost: cost.totalCost, method: v.method, minMarginPercent: num(v.minMarginPercent), manualFloorPrice: v.manualFloorPrice == null ? null : num(v.manualFloorPrice), roundingUnit: v.roundingUnit });
  const standard = num(v.service.standardPrice);
  const md = maxDiscount(standard, floorPrice);
  return tx.servicePriceFloorVersion.update({
    where: { id: versionId },
    data: {
      standardPriceSnapshot: standard, durationMinutes: minutes || null,
      materialCost: cost.byCategory.MATERIAL, staffCost: cost.byCategory.STAFF, machineCost: cost.byCategory.MACHINE,
      roomCost: cost.byCategory.ROOM, operationCost: cost.byCategory.OPERATION, otherCost: cost.byCategory.OTHER,
      totalCost: cost.totalCost, floorPrice, maxDiscount: md.amount, maxDiscountPercent: md.percent,
    },
    include: { lines: { orderBy: { orderIndex: "asc" } } },
  });
}

/** Tạo version DRAFT mới. Nếu không truyền lines → tự dựng từ định mức/nhân sự dịch vụ. */
export async function createFloorVersion(input: {
  serviceId: string; method?: string; minMarginPercent?: number; manualFloorPrice?: number | null;
  roundingUnit?: number; changeReason?: string | null; note?: string | null; createdBy?: string | null;
  lines?: Array<Record<string, unknown>>;
}) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true } });
  if (!service) throw new FloorError("Không tìm thấy dịch vụ", 404);

  const lines = input.lines && input.lines.length ? input.lines : await buildDefaultLinesFromService(input.serviceId);
  const last = await prisma.servicePriceFloorVersion.findFirst({ where: { serviceId: input.serviceId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (last?.version ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const v = await tx.servicePriceFloorVersion.create({
      data: {
        serviceId: input.serviceId, version: nextVersion, status: "DRAFT",
        method: (input.method as any) ?? "MARGIN", minMarginPercent: input.minMarginPercent ?? 0,
        manualFloorPrice: input.manualFloorPrice ?? null, roundingUnit: input.roundingUnit ?? 1000,
        changeReason: input.changeReason ?? null, note: input.note ?? null, createdBy: input.createdBy ?? null,
        lines: {
          create: lines.map((l, i) => ({
            category: l.category as any, name: String(l.name ?? ""), quantity: num(l.quantity) || 1,
            unit: (l.unit as string) ?? null, unitCost: num(l.unitCost), calcType: (l.calcType as any) ?? "FIXED",
            calcValue: l.calcValue == null ? null : num(l.calcValue), minutes: l.minutes == null ? null : Number(l.minutes),
            refId: (l.refId as string) ?? null, source: (l.source as string) ?? null,
            required: l.required !== false, note: (l.note as string) ?? null, orderIndex: (l.orderIndex as number) ?? i,
          })),
        },
      },
    });
    return recomputeVersion(v.id, tx);
  });
  return created;
}

/**
 * PH2 — Tạo Floor version MỚI từ một ServiceCostingVersion đã PHÁT HÀNH (PUBLISHED).
 *  - Snapshot `totalEstimatedCost` → `totalCost`; map 6 thành phần costing → 6 cột snapshot floor
 *    (MATERIAL=finalMaterial, STAFF=labor, MACHINE=equipment, ROOM=facility, OPERATION=overhead, OTHER=other).
 *  - Công thức chuẩn MARGIN: floor = totalCost / (1 − margin%). KHÔNG cost lines editable.
 *  - Không đọc cost LIVE khi validate về sau (snapshot bất biến sau publish/activate).
 */
export async function createFloorVersionFromCosting(input: {
  serviceId: string; serviceCostingVersionId: string; minMarginPercent: number;
  roundingUnit?: number; changeReason?: string | null; note?: string | null; createdBy?: string | null;
}) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true, standardPrice: true } });
  if (!service) throw new FloorError("Không tìm thấy dịch vụ", 404);
  const costing = await prisma.serviceCostingVersion.findUnique({ where: { id: input.serviceCostingVersionId } });
  if (!costing) throw new FloorError("Không tìm thấy version giá vốn", 404);
  if (costing.serviceId !== input.serviceId) throw new FloorError("Version giá vốn không thuộc dịch vụ này", 422);
  if (costing.status !== "PUBLISHED") throw new FloorError("Chỉ tạo giá sàn từ version giá vốn ĐÃ PHÁT HÀNH (PUBLISHED)", 422);

  const totalCost = num(costing.totalEstimatedCost);
  const roundingUnit = input.roundingUnit ?? 1000;
  const floorPrice = computeFloorPrice({ totalCost, method: "MARGIN", minMarginPercent: input.minMarginPercent, roundingUnit });
  const standard = num(service.standardPrice);
  const md = maxDiscount(standard, floorPrice);

  const last = await prisma.servicePriceFloorVersion.findFirst({ where: { serviceId: input.serviceId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (last?.version ?? 0) + 1;

  return prisma.servicePriceFloorVersion.create({
    data: {
      serviceId: input.serviceId, version: nextVersion, status: "DRAFT",
      method: "MARGIN", minMarginPercent: input.minMarginPercent, roundingUnit,
      durationMinutes: costing.durationMinutes ?? null,
      serviceCostingVersionId: costing.id, costSource: "COSTING_VERSION",
      // Snapshot cost (map costing → cột floor) — hiển thị breakdown + bất biến.
      standardPriceSnapshot: standard,
      materialCost: num(costing.finalMaterialCost), staffCost: num(costing.laborCost),
      machineCost: num(costing.equipmentCost), roomCost: num(costing.facilityCost),
      operationCost: num(costing.overheadCost), otherCost: num(costing.otherCost),
      totalCost, floorPrice, maxDiscount: md.amount, maxDiscountPercent: md.percent,
      changeReason: input.changeReason ?? null, note: input.note ?? null, createdBy: input.createdBy ?? null,
    },
  });
}

/** Sửa version — chỉ khi DRAFT/PENDING_APPROVAL. Thay toàn bộ lines nếu gửi. */
export async function updateFloorVersion(versionId: string, patch: Record<string, any>) {
  const v = await prisma.servicePriceFloorVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new FloorError("Không tìm thấy version giá sàn", 404);
  if (v.status !== "DRAFT" && v.status !== "PENDING_APPROVAL")
    throw new FloorError("Chỉ sửa được version ở trạng thái Bản nháp / Chờ duyệt", 409);

  const updated = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    if (patch.method !== undefined) data.method = patch.method;
    if (patch.minMarginPercent !== undefined) data.minMarginPercent = patch.minMarginPercent;
    if (patch.manualFloorPrice !== undefined) data.manualFloorPrice = patch.manualFloorPrice;
    if (patch.roundingUnit !== undefined) data.roundingUnit = patch.roundingUnit;
    if (patch.effectiveFrom !== undefined) data.effectiveFrom = patch.effectiveFrom;
    if (patch.effectiveTo !== undefined) data.effectiveTo = patch.effectiveTo;
    if (patch.changeReason !== undefined) data.changeReason = patch.changeReason;
    if (patch.note !== undefined) data.note = patch.note;
    // PH2 — costing-backed: KHÔNG cho thay cost lines (nguồn cost là Costing, bất biến).
    if (v.serviceCostingVersionId && Array.isArray(patch.lines))
      throw new FloorError("Version tạo từ Giá vốn — không sửa cost lines; đổi ở màn Giá vốn.", 409);
    await tx.servicePriceFloorVersion.update({ where: { id: versionId }, data });

    if (!v.serviceCostingVersionId && Array.isArray(patch.lines)) {
      await tx.priceFloorCostLine.deleteMany({ where: { versionId } });
      await tx.priceFloorCostLine.createMany({
        data: patch.lines.map((l: any, i: number) => ({
          versionId, category: l.category, name: String(l.name ?? ""), quantity: num(l.quantity) || 1,
          unit: l.unit ?? null, unitCost: num(l.unitCost), calcType: l.calcType ?? "FIXED",
          calcValue: l.calcValue == null ? null : num(l.calcValue), minutes: l.minutes == null ? null : Number(l.minutes),
          refId: l.refId ?? null, source: l.source ?? null, required: l.required !== false, note: l.note ?? null, orderIndex: i,
        })),
      });
    }
    return recomputeVersion(versionId, tx);
  });
  return updated;
}

/**
 * Chuyển trạng thái version. `canApprove` = người dùng có pricefloor.approve.
 *  - submit: DRAFT → PENDING_APPROVAL
 *  - approve: PENDING_APPROVAL → APPROVED (cần canApprove) — ghi người/thời điểm duyệt
 *  - activate: APPROVED → ACTIVE (cần canApprove) — set effectiveFrom, HẾT HẠN version ACTIVE cũ
 *  - cancel: DRAFT/PENDING/APPROVED → CANCELLED
 */
export async function transitionFloorVersion(versionId: string, action: string, opts: { effectiveFrom?: Date | null; effectiveTo?: Date | null; reason?: string | null; actor?: string | null; canApprove: boolean }) {
  const v = await prisma.servicePriceFloorVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new FloorError("Không tìm thấy version giá sàn", 404);

  if (action === "submit") {
    if (v.status !== "DRAFT") throw new FloorError("Chỉ gửi duyệt version Bản nháp", 409);
    return prisma.servicePriceFloorVersion.update({ where: { id: versionId }, data: { status: "PENDING_APPROVAL" } });
  }
  if (action === "approve") {
    if (!opts.canApprove) throw new FloorError("Cần quyền duyệt version giá sàn (pricefloor.approve)", 403);
    if (v.status !== "PENDING_APPROVAL") throw new FloorError("Chỉ duyệt version đang Chờ duyệt", 409);
    return prisma.servicePriceFloorVersion.update({ where: { id: versionId }, data: { status: "APPROVED", approvedBy: opts.actor ?? null, approvedAt: new Date() } });
  }
  if (action === "activate") {
    if (!opts.canApprove) throw new FloorError("Cần quyền duyệt version giá sàn (pricefloor.approve)", 403);
    if (v.status !== "APPROVED") throw new FloorError("Chỉ áp dụng version đã Duyệt", 409);
    const from = opts.effectiveFrom ?? new Date();
    return prisma.$transaction(async (tx) => {
      // Hết hạn mọi version ACTIVE khác của cùng dịch vụ.
      await tx.servicePriceFloorVersion.updateMany({
        where: { serviceId: v.serviceId, status: "ACTIVE", id: { not: versionId } },
        data: { status: "EXPIRED", effectiveTo: from },
      });
      return tx.servicePriceFloorVersion.update({
        where: { id: versionId },
        data: { status: "ACTIVE", effectiveFrom: from, effectiveTo: opts.effectiveTo ?? null, approvedBy: v.approvedBy ?? opts.actor ?? null, approvedAt: v.approvedAt ?? new Date() },
      });
    });
  }
  if (action === "cancel") {
    if (v.status === "ACTIVE" || v.status === "EXPIRED" || v.status === "CANCELLED")
      throw new FloorError("Không thể hủy version đang/đã hiệu lực hoặc đã hủy", 409);
    return prisma.servicePriceFloorVersion.update({ where: { id: versionId }, data: { status: "CANCELLED", changeReason: opts.reason ?? v.changeReason } });
  }
  throw new FloorError("Hành động không hợp lệ", 400);
}
