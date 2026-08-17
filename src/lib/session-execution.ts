// =============================================================================
// Redesign P4 — Actual Treatment Session execution.
//  * SessionExecutionItem = 1 dịch vụ THỰC TẾ đã làm trong buổi (1 Session = N item).
//  * Snapshot BẤT BIẾN đông cứng lúc thực hiện — reuse sopSnapshot() (P1). Sửa
//    Service/SOP/Product/Protocol về sau KHÔNG đổi snapshot đã đông cứng.
//  * KHÔNG có policy classification (Decision 2 defer) — chỉ lưu phương án + giá trị thực tế.
// =============================================================================
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serviceStepsInclude, sopSnapshot } from "@/lib/service-sop";

export const executionItemInclude = {
  service: { select: { id: true, code: true, name: true, version: true, durationMinutes: true } },
  bookingItem: { select: { id: true, serviceId: true, sortOrder: true } },
} satisfies Prisma.SessionExecutionItemInclude;

export const sessionExecutionsInclude = {
  executionItems: { orderBy: { sortOrder: "asc" }, include: executionItemInclude },
} satisfies Prisma.TreatmentSessionInclude;

export type ExecutionOptionSourceT = "SERVICE_SOP_OPTION" | "PROTOCOL_VARIANT" | "PRACTITIONER_ADHOC";

export interface ActualValueInput {
  stepName?: string | null;
  productName?: string | null;
  qtyStd?: number | null;
  qtyActual?: number | null;
  unit?: string | null;
  note?: string | null;
}

/**
 * Đông cứng snapshot cho 1 execution item. Chụp SOP hiện hành của Service (sopSnapshot)
 * + phương án đã chọn + các giá trị thực tế (qtyStd vs qtyActual). classification = null
 * (chưa build policy — Decision 2). Trả về object thuần (JSON) để lưu executionSnapshot.
 */
export async function buildExecutionSnapshot(opts: {
  serviceId: string;
  selectedOptionSource: ExecutionOptionSourceT;
  selectedOptionId?: string | null;
  selectedOptionName?: string | null;
  actualValues?: ActualValueInput[];
  instructions?: string | null;
}) {
  const service = await prisma.service.findUnique({
    where: { id: opts.serviceId },
    include: serviceStepsInclude,
  });
  if (!service) throw new Error("Không tìm thấy dịch vụ để chụp snapshot.");
  const sop = sopSnapshot(service); // bất biến (deep-clone)

  // Nếu chọn phương án SOP, đính kèm thông tin phương án từ chính SOP (để tái dựng).
  let selectedOption: any = null;
  if (opts.selectedOptionId) {
    for (const step of (service as any).steps ?? []) {
      const opt = (step.options ?? []).find((o: any) => o.id === opts.selectedOptionId);
      if (opt) {
        selectedOption = {
          id: opt.id, name: opt.name, selectMode: opt.selectMode, isDefault: opt.isDefault,
          stepName: step.name, spaProductId: opt.spaProductId,
          quantity: opt.quantity != null ? Number(opt.quantity) : null, unit: opt.unit,
          durationMinutes: opt.durationMinutes,
        };
        break;
      }
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    source: { kind: "SERVICE", id: service.id, code: service.code, name: service.name, version: service.version },
    option: {
      source: opts.selectedOptionSource,
      id: opts.selectedOptionId ?? null,
      name: opts.selectedOptionName ?? selectedOption?.name ?? null,
      selectMode: selectedOption?.selectMode ?? null,
      classification: null, // Decision 2 — DEFER: KHÔNG tự tính/ghi classification
    },
    sop, // toàn bộ bước/sản phẩm/công nghệ/phương án chuẩn (frozen)
    actualValues: (opts.actualValues ?? []).map((v) => ({
      stepName: v.stepName ?? null,
      productName: v.productName ?? null,
      qtyStd: v.qtyStd ?? null, // chuẩn nguồn (KHÔNG overwrite)
      qtyActual: v.qtyActual ?? null, // thực tế đã dùng
      unit: v.unit ?? null,
      note: v.note ?? null,
    })),
    instructions: opts.instructions ?? null,
    serviceVersion: service.version,
  };
}

/** Tổng hợp snapshot cấp BUỔI từ các execution item (roll-up) — dùng khi freeze session. */
export function buildSessionSnapshot(items: { serviceId: string; selectedOptionName?: string | null; executionSnapshot?: any }[]) {
  return {
    frozenAt: new Date().toISOString(),
    itemCount: items.length,
    items: items.map((it, i) => ({
      sortOrder: i,
      serviceId: it.serviceId,
      option: it.selectedOptionName ?? null,
      source: it.executionSnapshot?.source ?? null,
    })),
  };
}
