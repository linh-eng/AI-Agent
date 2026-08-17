// =============================================================================
// PRICING / COSTING — PH1: SERVICE COSTING FOUNDATION
// Tính GIÁ VỐN dịch vụ độc lập, CÓ VERSION, TÁCH khỏi Giá sàn (Floor).
//  * PH1 CHỈ tính COST — KHÔNG tính Floor / Recommended Price.
//  * Reuse (KHÔNG clone business logic):
//      - Vật tư: expectedMaterialCost() (P1) = Σ ServiceStepProduct.qty × SpaProduct.cost.
//      - Nhân sự: Service.staffRequirements × EmployeeRoleFee (hiệu lực ngày, mục 8).
//      - Thiết bị/Cơ sở/Khác: nhập tay (PH1 chưa có engine khấu hao).
//      - Overhead: MANUAL | FIXED_PER_SERVICE | PER_MINUTE (tối giản).
//  * Bất biến: version PUBLISHED snapshot cost + sourceSnapshot; đổi cost/fee/SOP
//    về sau KHÔNG đổi version cũ.
//  * KHÔNG double-write: KHÔNG ghi ngược expectedCost / floor / ServiceMaterialStandard.
// =============================================================================
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { serviceStepsInclude, expectedMaterialCost } from "./service-sop";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

/** Lỗi nghiệp vụ costing có mã HTTP. */
export class CostingError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

// -----------------------------------------------------------------------------
// Tính toán từng thành phần (thuần, có unit test)
// -----------------------------------------------------------------------------

export interface OverheadInput {
  method?: string | null; // MANUAL | FIXED_PER_SERVICE | PER_MINUTE
  value?: number | null;
  minutes?: number | null;
}

/** Overhead theo phương pháp phân bổ (tối giản). PER_MINUTE = value × minutes. */
export function computeOverhead(input: OverheadInput): number {
  const value = num(input.value);
  const minutes = num(input.minutes);
  switch (input.method) {
    case "PER_MINUTE":
      return value * minutes;
    case "FIXED_PER_SERVICE":
    case "MANUAL":
    default:
      return value;
  }
}

export interface CostBreakdownInput {
  finalMaterialCost: number;
  laborCost: number;
  equipmentCost: number;
  facilityCost: number;
  overheadCost: number;
  otherCost: number;
}

/**
 * Công thức tổng (PH1 §10):
 *  DirectCost = FinalMaterial + Labor + Equipment + Facility
 *  TotalEstimatedCost = DirectCost + Overhead + Other
 */
export function computeTotals(c: CostBreakdownInput): { directCost: number; totalEstimatedCost: number } {
  const directCost = num(c.finalMaterialCost) + num(c.laborCost) + num(c.equipmentCost) + num(c.facilityCost);
  const totalEstimatedCost = directCost + num(c.overheadCost) + num(c.otherCost);
  return { directCost, totalEstimatedCost };
}

// -----------------------------------------------------------------------------
// Nguồn LIVE — vật tư (từ SOP) và nhân sự (từ staffRequirements × EmployeeRoleFee)
// -----------------------------------------------------------------------------

export interface MaterialInput {
  stepName: string;
  productId: string;
  name: string;
  qty: number;
  unit: string | null;
  unitCost: number | null; // null = thiếu giá vốn (cảnh báo)
  amount: number;
}

export interface LaborInput {
  role: string;
  quantity: number;
  fee: number | null; // null = chưa khai báo phí (cảnh báo)
  amount: number;
}

export interface CostSourceResult {
  computedMaterialCost: number;
  materialInputs: MaterialInput[];
  laborCost: number;
  laborInputs: LaborInput[];
  warnings: string[]; // ví dụ: sản phẩm thiếu cost, vai trò chưa có phí
}

/**
 * Phí trung bình của một VAI TRÒ tại thời điểm `at` (không có employee cụ thể trong
 * staffRequirements): ưu tiên EmployeeRoleFee hiện hành của nhân sự ACTIVE có vai trò
 * đó; fallback defaultFee. Trả null nếu không nguồn nào → cảnh báo (không bịa 0).
 * (Cùng nguồn với buildDefaultLinesFromService — không clone logic khác.)
 */
export async function resolveRoleFeeAverage(role: string, at: Date, tx: Prisma.TransactionClient = prisma): Promise<number | null> {
  const roleFees = await tx.employeeRoleFee.findMany({
    where: {
      role,
      isActive: true,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      employee: { status: "ACTIVE" },
    },
    select: { fee: true },
  });
  let fees = roleFees.map((f) => num(f.fee)).filter((x) => x > 0);
  if (fees.length === 0) {
    const emps = await tx.employee.findMany({ where: { isActive: true, roles: { has: role } }, select: { defaultFee: true } });
    fees = emps.map((e) => num(e.defaultFee)).filter((x) => x > 0);
  }
  if (fees.length === 0) return null;
  return Math.round(fees.reduce((s, x) => s + x, 0) / fees.length);
}

/**
 * Tính vật tư (từ SOP) + nhân sự (từ staffRequirements) LIVE cho một dịch vụ.
 * KHÔNG ghi DB — chỉ đọc nguồn live để dựng draft/recalculate.
 */
export async function computeCostSources(serviceId: string, at: Date = new Date(), tx: Prisma.TransactionClient = prisma): Promise<CostSourceResult> {
  const service = await tx.service.findUnique({
    where: { id: serviceId },
    include: serviceStepsInclude,
  });
  if (!service) throw new CostingError("Không tìm thấy dịch vụ", 404);

  const warnings: string[] = [];

  // --- Vật tư từ SOP (ServiceStepProduct × SpaProduct.cost) ---
  const steps = (service as any).steps ?? [];
  const pids: string[] = steps.flatMap((s: any) => (s.products ?? []).map((p: any) => p.spaProductId).filter(Boolean));
  const prods = pids.length
    ? await tx.spaProduct.findMany({ where: { id: { in: pids } }, select: { id: true, cost: true, name: true } })
    : [];
  const costById = new Map(prods.map((p) => [p.id, p.cost == null ? null : num(p.cost)] as const));

  const materialInputs: MaterialInput[] = [];
  for (const s of steps) {
    for (const p of s.products ?? []) {
      if (!p.spaProductId) continue; // chỉ tính SP có gắn Catalog (có giá vốn)
      const uc = costById.has(p.spaProductId) ? costById.get(p.spaProductId)! : null;
      if (uc === null || uc === undefined) {
        warnings.push(`Sản phẩm "${p.name}" (bước "${s.name}") chưa khai báo giá vốn — không tính vào vật tư.`);
      }
      const qty = num(p.quantity);
      const unitCost = uc ?? null;
      materialInputs.push({ stepName: s.name, productId: p.spaProductId, name: p.name, qty, unit: p.unit ?? null, unitCost, amount: qty * (unitCost ?? 0) });
    }
  }
  // Dùng lại expectedMaterialCost (P1) làm nguồn sự thật cho tổng (chỉ SP có cost).
  const computedMaterialCost = expectedMaterialCost(
    steps,
    new Map(prods.filter((p) => p.cost != null).map((p) => [p.id, num(p.cost)]))
  );

  // --- Nhân sự từ staffRequirements × EmployeeRoleFee ---
  const staffReq = Array.isArray(service.staffRequirements) ? (service.staffRequirements as any[]) : [];
  const laborInputs: LaborInput[] = [];
  let laborCost = 0;
  for (const r of staffReq) {
    const role = String(r.role ?? "").trim();
    if (!role) continue;
    const quantity = num(r.quantity) || 1;
    const fee = await resolveRoleFeeAverage(role, at, tx);
    if (fee === null) {
      warnings.push(`Vai trò "${role}" chưa có phí (EmployeeRoleFee/defaultFee) — nhân sự tính 0, cần khai báo phí.`);
    }
    const amount = quantity * (fee ?? 0);
    laborCost += amount;
    laborInputs.push({ role, quantity, fee, amount });
  }

  return { computedMaterialCost, materialInputs, laborCost, laborInputs, warnings };
}

// -----------------------------------------------------------------------------
// Dựng dữ liệu tính đầy đủ cho một version (kết hợp live sources + manual inputs)
// -----------------------------------------------------------------------------

export interface CostingComputeInput {
  serviceVersion?: number | null;
  durationMinutes?: number | null;
  materialOverride?: number | null;
  equipmentCost?: number | null;
  facilityCost?: number | null;
  otherCost?: number | null;
  overheadMethod?: string | null;
  overheadValue?: number | null;
}

export interface CostingComputed {
  serviceVersionSnapshot: number | null;
  durationMinutes: number | null;
  computedMaterialCost: number;
  materialOverride: number | null;
  finalMaterialCost: number;
  laborCost: number;
  equipmentCost: number;
  facilityCost: number;
  otherCost: number;
  overheadMethod: string;
  overheadValue: number;
  overheadCost: number;
  directCost: number;
  totalEstimatedCost: number;
  materialInputs: MaterialInput[];
  laborInputs: LaborInput[];
  warnings: string[];
}

/** Tính đầy đủ một version từ nguồn LIVE + manual inputs. Không ghi DB. */
export async function computeCosting(serviceId: string, input: CostingComputeInput, at: Date = new Date(), tx: Prisma.TransactionClient = prisma): Promise<CostingComputed> {
  const src = await computeCostSources(serviceId, at, tx);
  const service = await tx.service.findUnique({ where: { id: serviceId }, select: { version: true, durationMinutes: true } });
  const durationMinutes = input.durationMinutes ?? service?.durationMinutes ?? null;

  const materialOverride = input.materialOverride ?? null;
  const finalMaterialCost = materialOverride != null ? num(materialOverride) : src.computedMaterialCost;

  const equipmentCost = num(input.equipmentCost);
  const facilityCost = num(input.facilityCost);
  const otherCost = num(input.otherCost);
  const overheadMethod = (input.overheadMethod as string) ?? "MANUAL";
  const overheadValue = num(input.overheadValue);
  const overheadCost = computeOverhead({ method: overheadMethod, value: overheadValue, minutes: durationMinutes });

  const { directCost, totalEstimatedCost } = computeTotals({
    finalMaterialCost, laborCost: src.laborCost, equipmentCost, facilityCost, overheadCost, otherCost,
  });

  return {
    serviceVersionSnapshot: input.serviceVersion ?? service?.version ?? null,
    durationMinutes,
    computedMaterialCost: src.computedMaterialCost,
    materialOverride,
    finalMaterialCost,
    laborCost: src.laborCost,
    equipmentCost, facilityCost, otherCost,
    overheadMethod, overheadValue, overheadCost,
    directCost, totalEstimatedCost,
    materialInputs: src.materialInputs, laborInputs: src.laborInputs, warnings: src.warnings,
  };
}

/** Dựng sourceSnapshot bất biến (evidence giải thích số cost) — chụp khi publish. */
export function buildSourceSnapshot(c: CostingComputed) {
  return JSON.parse(
    JSON.stringify({
      serviceVersion: c.serviceVersionSnapshot,
      durationMinutes: c.durationMinutes,
      materialInputs: c.materialInputs,
      laborInputs: c.laborInputs,
      equipmentInput: c.equipmentCost,
      facilityInput: c.facilityCost,
      overheadInput: { method: c.overheadMethod, value: c.overheadValue, minutes: c.durationMinutes, amount: c.overheadCost },
      otherInput: c.otherCost,
      capturedAt: new Date().toISOString(),
    })
  );
}

// -----------------------------------------------------------------------------
// Persist columns từ CostingComputed (dùng khi create/recalculate/publish)
// -----------------------------------------------------------------------------
export function computedToData(c: CostingComputed): Prisma.ServiceCostingVersionUncheckedUpdateInput {
  return {
    serviceVersionSnapshot: c.serviceVersionSnapshot,
    durationMinutes: c.durationMinutes,
    computedMaterialCost: c.computedMaterialCost,
    finalMaterialCost: c.finalMaterialCost,
    laborCost: c.laborCost,
    equipmentCost: c.equipmentCost,
    facilityCost: c.facilityCost,
    otherCost: c.otherCost,
    overheadMethod: c.overheadMethod as any,
    overheadValue: c.overheadValue,
    overheadCost: c.overheadCost,
    directCost: c.directCost,
    totalEstimatedCost: c.totalEstimatedCost,
  };
}

// -----------------------------------------------------------------------------
// Finance mask — mọi field cost nhạy cảm (PH1 §14, BLOCKER)
// -----------------------------------------------------------------------------
export const COSTING_SENSITIVE_FIELDS = [
  "computedMaterialCost", "materialOverride", "finalMaterialCost", "laborCost",
  "equipmentCost", "facilityCost", "otherCost", "overheadValue", "overheadCost",
  "directCost", "totalEstimatedCost", "sourceSnapshot",
] as const;

/** Che toàn bộ số liệu cost (kể cả sourceSnapshot chứa unitCost/fee) nếu không finance.read. */
export function maskCosting<T extends Record<string, any>>(obj: T, canSee: boolean): T {
  if (canSee) return obj;
  const clone: Record<string, any> = { ...obj };
  for (const f of COSTING_SENSITIVE_FIELDS) if (f in clone) clone[f] = null;
  return clone as T;
}

// -----------------------------------------------------------------------------
// Service layer — create / update / recalculate / publish
// -----------------------------------------------------------------------------

/** Tạo version DRAFT mới (tính từ nguồn LIVE + manual inputs). */
export async function createCostingVersion(input: {
  serviceId: string;
  materialOverride?: number | null;
  materialOverrideReason?: string | null;
  equipmentCost?: number | null;
  facilityCost?: number | null;
  otherCost?: number | null;
  overheadMethod?: string | null;
  overheadValue?: number | null;
  durationMinutes?: number | null;
  note?: string | null;
  createdBy?: string | null;
}) {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true } });
  if (!service) throw new CostingError("Không tìm thấy dịch vụ", 404);

  const c = await computeCosting(input.serviceId, input);
  const last = await prisma.serviceCostingVersion.findFirst({ where: { serviceId: input.serviceId }, orderBy: { version: "desc" }, select: { version: true } });
  const nextVersion = (last?.version ?? 0) + 1;

  const created = await prisma.serviceCostingVersion.create({
    data: {
      serviceId: input.serviceId,
      version: nextVersion,
      status: "DRAFT",
      materialOverride: input.materialOverride ?? null,
      materialOverrideReason: input.materialOverride != null ? (input.materialOverrideReason ?? null) : null,
      overheadMethod: (input.overheadMethod as any) ?? "MANUAL",
      overheadValue: num(input.overheadValue),
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
      ...(computedToData(c) as any),
    },
  });
  return { version: created, warnings: c.warnings };
}

/** Sửa version DRAFT + tính lại từ nguồn LIVE. Chặn nếu không phải DRAFT. */
export async function updateCostingVersion(versionId: string, patch: {
  materialOverride?: number | null;
  materialOverrideReason?: string | null;
  equipmentCost?: number | null;
  facilityCost?: number | null;
  otherCost?: number | null;
  overheadMethod?: string | null;
  overheadValue?: number | null;
  durationMinutes?: number | null;
  note?: string | null;
}) {
  const v = await prisma.serviceCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new CostingError("Không tìm thấy version giá vốn", 404);
  if (v.status !== "DRAFT") throw new CostingError("Chỉ sửa được version ở trạng thái Bản nháp", 409);

  const merged = {
    materialOverride: patch.materialOverride !== undefined ? patch.materialOverride : (v.materialOverride == null ? null : num(v.materialOverride)),
    equipmentCost: patch.equipmentCost !== undefined ? patch.equipmentCost : num(v.equipmentCost),
    facilityCost: patch.facilityCost !== undefined ? patch.facilityCost : num(v.facilityCost),
    otherCost: patch.otherCost !== undefined ? patch.otherCost : num(v.otherCost),
    overheadMethod: patch.overheadMethod !== undefined ? patch.overheadMethod : v.overheadMethod,
    overheadValue: patch.overheadValue !== undefined ? patch.overheadValue : num(v.overheadValue),
    durationMinutes: patch.durationMinutes !== undefined ? patch.durationMinutes : v.durationMinutes,
  };
  const c = await computeCosting(v.serviceId, merged);
  const overrideChanged =
    patch.materialOverride !== undefined &&
    num(patch.materialOverride) !== num(v.materialOverride);

  const updated = await prisma.serviceCostingVersion.update({
    where: { id: versionId },
    data: {
      materialOverride: merged.materialOverride,
      materialOverrideReason: merged.materialOverride != null
        ? (patch.materialOverrideReason ?? v.materialOverrideReason ?? null)
        : null,
      overheadMethod: (merged.overheadMethod as any) ?? "MANUAL",
      overheadValue: num(merged.overheadValue),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(computedToData(c) as any),
    },
  });
  return { version: updated, warnings: c.warnings, overrideChanged };
}

/** Tính lại DRAFT từ nguồn LIVE hiện tại (không đổi manual inputs đã lưu). */
export async function recalculateCostingVersion(versionId: string) {
  const v = await prisma.serviceCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new CostingError("Không tìm thấy version giá vốn", 404);
  if (v.status !== "DRAFT") throw new CostingError("Chỉ tính lại được version Bản nháp", 409);
  const c = await computeCosting(v.serviceId, {
    materialOverride: v.materialOverride == null ? null : num(v.materialOverride),
    equipmentCost: num(v.equipmentCost),
    facilityCost: num(v.facilityCost),
    otherCost: num(v.otherCost),
    overheadMethod: v.overheadMethod,
    overheadValue: num(v.overheadValue),
    durationMinutes: v.durationMinutes,
  });
  const updated = await prisma.serviceCostingVersion.update({ where: { id: versionId }, data: computedToData(c) as any });
  return { version: updated, warnings: c.warnings };
}

/** Phát hành DRAFT → PUBLISHED: đông cứng snapshot; version PUBLISHED cũ → SUPERSEDED. */
export async function publishCostingVersion(versionId: string, actor?: string | null) {
  const v = await prisma.serviceCostingVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new CostingError("Không tìm thấy version giá vốn", 404);
  if (v.status !== "DRAFT") throw new CostingError("Chỉ phát hành được version Bản nháp", 409);

  // Chụp lại từ LIVE ngay lúc publish → snapshot bất biến khớp số hiển thị.
  const c = await computeCosting(v.serviceId, {
    materialOverride: v.materialOverride == null ? null : num(v.materialOverride),
    equipmentCost: num(v.equipmentCost),
    facilityCost: num(v.facilityCost),
    otherCost: num(v.otherCost),
    overheadMethod: v.overheadMethod,
    overheadValue: num(v.overheadValue),
    durationMinutes: v.durationMinutes,
  });
  const snapshot = buildSourceSnapshot(c);

  const published = await prisma.$transaction(async (tx) => {
    // version PUBLISHED trước đó của cùng dịch vụ → SUPERSEDED (giữ nguyên, không xóa).
    const prev = await tx.serviceCostingVersion.findFirst({
      where: { serviceId: v.serviceId, status: "PUBLISHED", id: { not: versionId } },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    if (prev) {
      await tx.serviceCostingVersion.updateMany({
        where: { serviceId: v.serviceId, status: "PUBLISHED", id: { not: versionId } },
        data: { status: "SUPERSEDED" },
      });
    }
    return tx.serviceCostingVersion.update({
      where: { id: versionId },
      data: {
        status: "PUBLISHED",
        publishedBy: actor ?? null,
        publishedAt: new Date(),
        supersedesId: prev?.id ?? null,
        sourceSnapshot: snapshot,
        ...(computedToData(c) as any),
      },
    });
  });
  return { version: published, warnings: c.warnings };
}

/** Version PUBLISHED hiện hành của một dịch vụ (nếu có). */
export async function activeCostingVersion(serviceId: string) {
  return prisma.serviceCostingVersion.findFirst({
    where: { serviceId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
}
