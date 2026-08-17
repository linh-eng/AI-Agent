// =============================================================================
// PRICING / COSTING — PH5: PROTOCOL / PACKAGE PRICING
// Giá vốn / giá sàn / giá đề xuất cấp GÓI cho Protocol compositionMode = SERVICES.
//  * Package cost = Σ ServiceCostingVersion PUBLISHED của Service THÀNH PHẦN (BẮT BUỘC)
//    + packageSpecificCost. Optional service KHÔNG cộng vào base (owner decision §16).
//  * Floor/Recommended dùng công thức MARGIN như cấp Service (nguồn = package cost).
//  * Selling price = PriceRule targetType=PACKAGE, targetId=protocolId (PriceBook).
//  * Additive, độc lập — KHÔNG ghi ngược ServiceCosting/Floor/Recommended/PriceRule/Service.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { computeFloorPrice, maxDiscount } from "./price-floor";
import { activeCostingVersion } from "./service-costing";
import { resolvePrice, priceTypesForCustomer } from "./pricing";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export class ProtocolPricingError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

// -----------------------------------------------------------------------------
// Component cost — resolve ServiceCostingVersion PUBLISHED của từng ProtocolService
// -----------------------------------------------------------------------------
export interface ComponentCost {
  protocolServiceId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  serviceVersionMarker: number | null;
  required: boolean;
  serviceCostingVersionId: string | null;
  costSnapshot: number; // totalEstimatedCost của component (0 nếu optional/không tính)
  included: boolean; // có cộng vào base package cost không (required = true)
}

export interface ProtocolCostSourceResult {
  compositionMode: string;
  protocolVersion: number;
  serviceCostTotal: number; // Σ required components
  components: ComponentCost[];
  warnings: string[];
}

/**
 * Đọc Protocol SERVICES + resolve costing PUBLISHED cho từng Service thành phần.
 *  - Chỉ áp cho compositionMode = SERVICES (khác → 422).
 *  - Component BẮT BUỘC thiếu costing PUBLISHED → 422 (không bịa).
 *  - Base cost = Σ required component costing; optional ghi nhận nhưng KHÔNG cộng (§16).
 */
export async function computeProtocolCostSources(protocolId: string, tx: Prisma.TransactionClient = prisma): Promise<ProtocolCostSourceResult> {
  const protocol = await tx.brandProtocol.findUnique({
    where: { id: protocolId },
    include: { services: { orderBy: { sortOrder: "asc" }, include: { service: { select: { id: true, name: true, version: true } } } } },
  });
  if (!protocol) throw new ProtocolPricingError("Không tìm thấy protocol", 404);
  if (protocol.compositionMode !== "SERVICES") throw new ProtocolPricingError("Giá gói chỉ áp cho Protocol tổ chức theo Dịch vụ (SERVICES)", 422);

  const warnings: string[] = [];
  const components: ComponentCost[] = [];
  let serviceCostTotal = 0;

  for (const ps of protocol.services) {
    const costing = await activeCostingVersion(ps.serviceId); // ServiceCostingVersion PUBLISHED mới nhất
    const required = ps.isRequired;
    if (required && !costing) {
      throw new ProtocolPricingError(`Dịch vụ "${ps.service?.name}" (bắt buộc) chưa có Giá vốn PHÁT HÀNH — không tính được giá gói`, 422);
    }
    if (!required && !costing) {
      warnings.push(`Dịch vụ tùy chọn "${ps.service?.name}" chưa có Giá vốn phát hành — bỏ qua.`);
    }
    const cost = costing ? num(costing.totalEstimatedCost) : 0;
    const included = required; // base = required only
    if (included) serviceCostTotal += cost;
    else if (costing) warnings.push(`Dịch vụ tùy chọn "${ps.service?.name}" KHÔNG cộng vào giá gói cơ sở (chỉ tính dịch vụ bắt buộc).`);
    components.push({
      protocolServiceId: ps.id, serviceId: ps.serviceId, serviceNameSnapshot: ps.service?.name ?? "",
      serviceVersionMarker: ps.service?.version ?? null, required,
      serviceCostingVersionId: costing?.id ?? null, costSnapshot: cost, included,
    });
  }

  return { compositionMode: protocol.compositionMode, protocolVersion: protocol.version, serviceCostTotal, components, warnings };
}

function buildProtocolSourceSnapshot(protocolId: string, src: ProtocolCostSourceResult, packageSpecificCost: number) {
  return JSON.parse(JSON.stringify({
    protocolId, protocolVersion: src.protocolVersion, compositionMode: src.compositionMode,
    components: src.components.map((c) => ({
      protocolServiceId: c.protocolServiceId, serviceId: c.serviceId, serviceNameSnapshot: c.serviceNameSnapshot,
      required: c.required, serviceCostingVersionId: c.serviceCostingVersionId, costSnapshot: c.costSnapshot, included: c.included,
    })),
    packageSpecificCost, capturedAt: new Date().toISOString(),
  }));
}

// -----------------------------------------------------------------------------
// Protocol Costing — create / update / recalculate / publish
// -----------------------------------------------------------------------------
export async function createProtocolCostingVersion(input: {
  protocolId: string; packageSpecificCost?: number | null; packageSpecificReason?: string | null;
  note?: string | null; createdBy?: string | null;
}) {
  const src = await computeProtocolCostSources(input.protocolId);
  const packageSpecificCost = num(input.packageSpecificCost);
  if (packageSpecificCost > 0 && !(input.packageSpecificReason && input.packageSpecificReason.trim()))
    throw new ProtocolPricingError("Chi phí riêng của gói cần lý do", 422);
  const totalEstimatedCost = src.serviceCostTotal + packageSpecificCost;

  const last = await prisma.protocolCostingVersion.findFirst({ where: { protocolId: input.protocolId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (last?.version ?? 0) + 1;

  const created = await prisma.protocolCostingVersion.create({
    data: {
      protocolId: input.protocolId, version: nextVersion, status: "DRAFT",
      compositionModeSnapshot: src.compositionMode, protocolVersionSnapshot: src.protocolVersion,
      serviceCostTotal: src.serviceCostTotal, packageSpecificCost,
      packageSpecificReason: packageSpecificCost > 0 ? (input.packageSpecificReason ?? null) : null,
      totalEstimatedCost, note: input.note ?? null, createdBy: input.createdBy ?? null,
    },
  });
  return { version: created, warnings: src.warnings, components: src.components };
}

export async function updateProtocolCostingVersion(versionId: string, patch: { packageSpecificCost?: number | null; packageSpecificReason?: string | null; note?: string | null }) {
  const v = await prisma.protocolCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new ProtocolPricingError("Không tìm thấy version giá vốn gói", 404);
  if (v.status !== "DRAFT") throw new ProtocolPricingError("Chỉ sửa được version Bản nháp", 409);
  const src = await computeProtocolCostSources(v.protocolId);
  const packageSpecificCost = patch.packageSpecificCost !== undefined ? num(patch.packageSpecificCost) : num(v.packageSpecificCost);
  if (packageSpecificCost > 0) {
    const reason = patch.packageSpecificReason !== undefined ? patch.packageSpecificReason : v.packageSpecificReason;
    if (!(reason && reason.trim())) throw new ProtocolPricingError("Chi phí riêng của gói cần lý do", 422);
  }
  const totalEstimatedCost = src.serviceCostTotal + packageSpecificCost;
  const updated = await prisma.protocolCostingVersion.update({
    where: { id: versionId },
    data: {
      serviceCostTotal: src.serviceCostTotal, packageSpecificCost,
      packageSpecificReason: packageSpecificCost > 0 ? (patch.packageSpecificReason ?? v.packageSpecificReason ?? null) : null,
      totalEstimatedCost, protocolVersionSnapshot: src.protocolVersion,
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    },
  });
  return { version: updated, warnings: src.warnings };
}

export async function recalculateProtocolCostingVersion(versionId: string) {
  const v = await prisma.protocolCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new ProtocolPricingError("Không tìm thấy version giá vốn gói", 404);
  if (v.status !== "DRAFT") throw new ProtocolPricingError("Chỉ tính lại được version Bản nháp", 409);
  const src = await computeProtocolCostSources(v.protocolId);
  const totalEstimatedCost = src.serviceCostTotal + num(v.packageSpecificCost);
  const updated = await prisma.protocolCostingVersion.update({
    where: { id: versionId }, data: { serviceCostTotal: src.serviceCostTotal, totalEstimatedCost, protocolVersionSnapshot: src.protocolVersion },
  });
  return { version: updated, warnings: src.warnings };
}

export async function publishProtocolCostingVersion(versionId: string, actor?: string | null) {
  const v = await prisma.protocolCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new ProtocolPricingError("Không tìm thấy version giá vốn gói", 404);
  if (v.status !== "DRAFT") throw new ProtocolPricingError("Chỉ phát hành được version Bản nháp", 409);
  const src = await computeProtocolCostSources(v.protocolId);
  const totalEstimatedCost = src.serviceCostTotal + num(v.packageSpecificCost);
  const snapshot = buildProtocolSourceSnapshot(v.protocolId, src, num(v.packageSpecificCost));

  return prisma.$transaction(async (tx) => {
    const prev = await tx.protocolCostingVersion.findFirst({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, orderBy: { version: "desc" }, select: { id: true } });
    if (prev) await tx.protocolCostingVersion.updateMany({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, data: { status: "SUPERSEDED" } });
    return tx.protocolCostingVersion.update({
      where: { id: versionId },
      data: { status: "PUBLISHED", publishedBy: actor ?? null, publishedAt: new Date(), supersedesId: prev?.id ?? null, serviceCostTotal: src.serviceCostTotal, totalEstimatedCost, sourceSnapshot: snapshot, protocolVersionSnapshot: src.protocolVersion },
    });
  });
}

export async function activeProtocolCostingVersion(protocolId: string) {
  return prisma.protocolCostingVersion.findFirst({ where: { protocolId, status: "PUBLISHED" }, orderBy: { version: "desc" } });
}

// -----------------------------------------------------------------------------
// Protocol Floor — từ ProtocolCostingVersion PUBLISHED (MARGIN)
// -----------------------------------------------------------------------------
export async function createProtocolFloorVersion(input: {
  protocolId: string; protocolCostingVersionId: string; minMarginPercent: number; roundingUnit?: number; note?: string | null; createdBy?: string | null;
}) {
  const costing = await prisma.protocolCostingVersion.findUnique({ where: { id: input.protocolCostingVersionId } });
  if (!costing) throw new ProtocolPricingError("Không tìm thấy giá vốn gói", 404);
  if (costing.protocolId !== input.protocolId) throw new ProtocolPricingError("Giá vốn gói không thuộc protocol này", 422);
  if (costing.status !== "PUBLISHED") throw new ProtocolPricingError("Chỉ tạo giá sàn gói từ giá vốn ĐÃ PHÁT HÀNH", 422);
  const totalCost = num(costing.totalEstimatedCost);
  const roundingUnit = input.roundingUnit ?? 1000;
  const floorPrice = computeFloorPrice({ totalCost, method: "MARGIN", minMarginPercent: input.minMarginPercent, roundingUnit });
  const last = await prisma.protocolFloorPriceVersion.findFirst({ where: { protocolId: input.protocolId }, orderBy: { version: "desc" }, select: { version: true } });
  return prisma.protocolFloorPriceVersion.create({
    data: { protocolId: input.protocolId, protocolCostingVersionId: input.protocolCostingVersionId, version: (last?.version ?? 0) + 1, status: "DRAFT", minMarginPercent: input.minMarginPercent, costSnapshot: totalCost, roundingUnit, floorPrice, note: input.note ?? null, createdBy: input.createdBy ?? null },
  });
}

export async function publishProtocolFloorVersion(versionId: string, actor?: string | null) {
  const v = await prisma.protocolFloorPriceVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new ProtocolPricingError("Không tìm thấy giá sàn gói", 404);
  if (v.status !== "DRAFT") throw new ProtocolPricingError("Chỉ phát hành được version Bản nháp", 409);
  return prisma.$transaction(async (tx) => {
    const prev = await tx.protocolFloorPriceVersion.findFirst({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, orderBy: { version: "desc" }, select: { id: true } });
    if (prev) await tx.protocolFloorPriceVersion.updateMany({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, data: { status: "SUPERSEDED" } });
    return tx.protocolFloorPriceVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", publishedBy: actor ?? null, publishedAt: new Date(), supersedesId: prev?.id ?? null } });
  });
}

export async function activeProtocolFloorVersion(protocolId: string) {
  return prisma.protocolFloorPriceVersion.findFirst({ where: { protocolId, status: "PUBLISHED" }, orderBy: { version: "desc" } });
}

/** Kiểm tra giá bán gói so với giá sàn gói ACTIVE. hasFloor=false nếu chưa khai. */
export async function checkProtocolFloor(protocolId: string, price: number) {
  const floor = await activeProtocolFloorVersion(protocolId);
  if (!floor) return { hasFloor: false, floorPrice: 0, below: false, shortfall: 0, floorVersionId: null as string | null, minMarginPercent: 0 };
  const floorPrice = num(floor.floorPrice);
  const below = num(price) + 1e-6 < floorPrice;
  return { hasFloor: true, floorPrice, below, shortfall: below ? floorPrice - num(price) : 0, floorVersionId: floor.id, minMarginPercent: num(floor.minMarginPercent) };
}

// -----------------------------------------------------------------------------
// Protocol Recommended — target margin (ràng buộc Floor gói)
// -----------------------------------------------------------------------------
export async function createProtocolRecommendedVersion(input: {
  protocolId: string; protocolCostingVersionId: string; targetMarginPercent: number; roundingUnit?: number; note?: string | null; createdBy?: string | null;
}) {
  const costing = await prisma.protocolCostingVersion.findUnique({ where: { id: input.protocolCostingVersionId } });
  if (!costing) throw new ProtocolPricingError("Không tìm thấy giá vốn gói", 404);
  if (costing.protocolId !== input.protocolId) throw new ProtocolPricingError("Giá vốn gói không thuộc protocol này", 422);
  if (costing.status !== "PUBLISHED") throw new ProtocolPricingError("Chỉ tạo giá đề xuất gói từ giá vốn ĐÃ PHÁT HÀNH", 422);
  const totalCost = num(costing.totalEstimatedCost);
  const roundingUnit = input.roundingUnit ?? 1000;
  const recommended = computeFloorPrice({ totalCost, method: "MARGIN", minMarginPercent: input.targetMarginPercent, roundingUnit });

  const floor = await activeProtocolFloorVersion(input.protocolId);
  let floorVersionId: string | null = null; let floorPriceSnapshot: number | null = null;
  if (floor) {
    floorVersionId = floor.id; floorPriceSnapshot = num(floor.floorPrice);
    if (num(input.targetMarginPercent) + 1e-9 < num(floor.minMarginPercent))
      throw new ProtocolPricingError(`Biên mục tiêu (${num(input.targetMarginPercent)}%) không được thấp hơn biên tối thiểu giá sàn gói (${num(floor.minMarginPercent)}%)`, 422);
    if (recommended + 1e-6 < floorPriceSnapshot)
      throw new ProtocolPricingError(`Giá đề xuất gói (${recommended}) thấp hơn giá sàn gói (${floorPriceSnapshot})`, 422);
  }
  const last = await prisma.protocolRecommendedPriceVersion.findFirst({ where: { protocolId: input.protocolId }, orderBy: { version: "desc" }, select: { version: true } });
  return prisma.protocolRecommendedPriceVersion.create({
    data: { protocolId: input.protocolId, protocolCostingVersionId: input.protocolCostingVersionId, version: (last?.version ?? 0) + 1, status: "DRAFT", targetMarginPercent: input.targetMarginPercent, costSnapshot: totalCost, roundingUnit, calculatedRecommendedPrice: recommended, floorVersionId, floorPriceSnapshot, note: input.note ?? null, createdBy: input.createdBy ?? null },
  });
}

export async function publishProtocolRecommendedVersion(versionId: string, actor?: string | null) {
  const v = await prisma.protocolRecommendedPriceVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new ProtocolPricingError("Không tìm thấy giá đề xuất gói", 404);
  if (v.status !== "DRAFT") throw new ProtocolPricingError("Chỉ phát hành được version Bản nháp", 409);
  return prisma.$transaction(async (tx) => {
    const prev = await tx.protocolRecommendedPriceVersion.findFirst({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, orderBy: { version: "desc" }, select: { id: true } });
    if (prev) await tx.protocolRecommendedPriceVersion.updateMany({ where: { protocolId: v.protocolId, status: "PUBLISHED", id: { not: versionId } }, data: { status: "SUPERSEDED" } });
    return tx.protocolRecommendedPriceVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", publishedBy: actor ?? null, publishedAt: new Date(), supersedesId: prev?.id ?? null } });
  });
}

export async function activeProtocolRecommendedVersion(protocolId: string) {
  return prisma.protocolRecommendedPriceVersion.findFirst({ where: { protocolId, status: "PUBLISHED" }, orderBy: { version: "desc" } });
}

// -----------------------------------------------------------------------------
// Package selling price (PriceRule targetType=PACKAGE, targetId=protocolId) + so sánh retail
// -----------------------------------------------------------------------------
export async function resolvePackagePrice(protocolId: string, opts: { at?: Date; branch?: string | null; customerGroup?: string | null } = {}) {
  return resolvePrice("PACKAGE", protocolId, { at: opts.at, branch: opts.branch ?? undefined, types: priceTypesForCustomer(opts.customerGroup) });
}

/** So sánh (derived): Σ giá bán lẻ dịch vụ BẮT BUỘC vs giá gói (standard) — commercial only. */
export async function packageRetailComparison(protocolId: string) {
  const protocol = await prisma.brandProtocol.findUnique({
    where: { id: protocolId },
    include: { services: { where: { isRequired: true }, include: { service: { select: { standardPrice: true } } } } },
  });
  const sumRetail = (protocol?.services ?? []).reduce((s, ps) => s + num(ps.service?.standardPrice), 0);
  const pkg = await resolvePrice("PACKAGE", protocolId, {}); // STANDARD package (no segment)
  const packagePrice = pkg ? pkg.price : null;
  const saving = packagePrice != null ? sumRetail - packagePrice : null;
  return { sumRetail, packagePrice, packagePriceType: pkg?.priceType ?? null, saving };
}

// -----------------------------------------------------------------------------
// Finance mask
// -----------------------------------------------------------------------------
const COSTING_SENSITIVE = ["serviceCostTotal", "packageSpecificCost", "totalEstimatedCost", "costSnapshot", "sourceSnapshot"] as const;
export function maskProtocolCosting<T extends Record<string, any>>(obj: T, canSee: boolean): T {
  if (canSee) return obj;
  const clone: Record<string, any> = { ...obj };
  for (const f of COSTING_SENSITIVE) if (f in clone) clone[f] = null;
  if ("components" in clone) clone.components = null;
  return clone as T;
}
const REC_SENSITIVE = ["targetMarginPercent", "costSnapshot"] as const;
export function maskProtocolRecommended<T extends Record<string, any>>(obj: T, canSee: boolean): T {
  if (canSee) return obj;
  const clone: Record<string, any> = { ...obj };
  for (const f of REC_SENSITIVE) if (f in clone) clone[f] = null;
  return clone as T;
}
