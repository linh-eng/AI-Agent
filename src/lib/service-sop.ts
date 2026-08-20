// =============================================================================
// SOP chuẩn hóa của Dịch vụ (Redesign P1) — tiện ích cho ServiceStep + Product/
// Technology/Option. Thuần additive; KHÔNG trừ kho (đây là ĐỊNH MỨC/SOP).
// Snapshot bất biến: sửa Service (bump version) KHÔNG đổi bản snapshot đã chụp.
// =============================================================================
import type { Prisma } from "@prisma/client";

/** include đầy đủ để đọc SOP của một dịch vụ (bước → sản phẩm/công nghệ/phương án). */
export const stepInclude = {
  products: { orderBy: { sortOrder: "asc" } },
  technologies: { include: { technology: { select: { id: true, name: true, code: true } } } },
  options: { orderBy: { sortOrder: "asc" } },
  linkedService: { select: { id: true, code: true, name: true, durationMinutes: true, version: true } },
} satisfies Prisma.ServiceStepInclude;

export const serviceStepsInclude = {
  steps: { orderBy: { sortOrder: "asc" }, include: stepInclude },
} satisfies Prisma.ServiceInclude;

type StepInput = {
  name: string;
  description?: string | null;
  durationMinutes?: number | null;
  technique?: string | null;
  notes?: string | null;
  warnings?: string | null;
  isRequired?: boolean;
  conditionText?: string | null;
  linkedServiceId?: string | null;
  products?: any[];
  technologies?: any[];
  options?: any[];
};

/** Dựng mảng nested-create cho steps (kèm product/technology/option) — dùng khi tạo/thay SOP. */
export function buildStepsCreate(steps: StepInput[] | undefined): Prisma.ServiceStepCreateWithoutServiceInput[] | undefined {
  if (!steps) return undefined;
  return steps.map((s, i) => ({
    sortOrder: i,
    name: s.name,
    description: s.description ?? null,
    durationMinutes: s.durationMinutes ?? null,
    technique: s.technique ?? null,
    notes: s.notes ?? null,
    warnings: s.warnings ?? null,
    isRequired: s.isRequired ?? true,
    conditionText: s.conditionText ?? null,
    linkedServiceId: s.linkedServiceId ?? null,
    products: {
      create: (s.products ?? []).map((p, j) => ({
        spaProductId: p.spaProductId ?? null,
        name: p.name,
        quantity: p.quantity ?? 1,
        unit: p.unit,
        isRequired: p.isRequired ?? true,
        notes: p.notes ?? null,
        sortOrder: j,
      })),
    },
    technologies: {
      create: (s.technologies ?? []).map((t) => ({
        technologyId: t.technologyId,
        suggestedParameters: t.suggestedParameters ?? undefined,
        notes: t.notes ?? null,
      })),
    },
    options: {
      create: (s.options ?? []).map((o, j) => ({
        name: o.name,
        selectMode: o.selectMode ?? "SINGLE_SELECT",
        isDefault: o.isDefault ?? false,
        spaProductId: o.spaProductId ?? null,
        quantity: o.quantity ?? null,
        unit: o.unit ?? null,
        technique: o.technique ?? null,
        durationMinutes: o.durationMinutes ?? null,
        notes: o.notes ?? null,
        conditionText: o.conditionText ?? null,
        sortOrder: j,
      })),
    },
  }));
}

/** Tổng thời lượng SOP = tổng thời lượng các bước (phút). */
export function sopTotalDuration(steps: { durationMinutes?: number | null }[] | undefined): number {
  return (steps ?? []).reduce((s, x) => s + (x.durationMinutes ?? 0), 0);
}

/**
 * Chụp SNAPSHOT bất biến của SOP tại một thời điểm (version + toàn bộ bước/sản phẩm/
 * công nghệ/phương án). Trả về object thuần (deep-clone) — sửa Service về sau KHÔNG
 * ảnh hưởng snapshot đã chụp. Dùng cho Actual Session (P4) & chứng minh mục 9.
 */
export function sopSnapshot(service: any) {
  return JSON.parse(
    JSON.stringify({
      serviceId: service.id,
      serviceCode: service.code,
      serviceName: service.name,
      version: service.version,
      capturedAt: new Date().toISOString(),
      totalDuration: sopTotalDuration(service.steps),
      steps: (service.steps ?? []).map((s: any) => ({
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        technique: s.technique,
        warnings: s.warnings,
        isRequired: s.isRequired,
        conditionText: s.conditionText,
        linkedServiceId: s.linkedServiceId ?? null,
        linkedServiceCode: s.linkedService?.code ?? null,
        linkedServiceName: s.linkedService?.name ?? null,
        products: (s.products ?? []).map((p: any) => ({
          spaProductId: p.spaProductId, name: p.name, quantity: Number(p.quantity), unit: p.unit, isRequired: p.isRequired,
        })),
        technologies: (s.technologies ?? []).map((t: any) => ({
          technologyId: t.technologyId, name: t.technology?.name, suggestedParameters: t.suggestedParameters,
        })),
        options: (s.options ?? []).map((o: any) => ({
          name: o.name, selectMode: o.selectMode, isDefault: o.isDefault,
          spaProductId: o.spaProductId, quantity: o.quantity != null ? Number(o.quantity) : null,
          unit: o.unit, durationMinutes: o.durationMinutes, conditionText: o.conditionText,
        })),
      })),
    })
  );
}

/** Chi phí vật tư định mức dự kiến (nhạy cảm — chỉ hiện khi finance.read). */
export function expectedMaterialCost(steps: any[] | undefined, productCostById: Map<string, number>): number {
  let total = 0;
  for (const s of steps ?? []) {
    for (const p of s.products ?? []) {
      if (p.spaProductId && productCostById.has(p.spaProductId)) {
        total += Number(p.quantity) * (productCostById.get(p.spaProductId) ?? 0);
      }
    }
  }
  return total;
}
