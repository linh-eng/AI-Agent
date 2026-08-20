// =============================================================================
// KÊ TOA SAU THỰC HIỆN — tiện ích. Toa (Prescription) = sản phẩm dùng tại nhà +
// lời dặn, kê sau buổi trị liệu; in được + lưu hồ sơ khách (CrmActivity timeline).
// Thuần additive; KHÔNG trừ kho (là toa/tư vấn, không phải bán hàng).
// =============================================================================
import { prisma } from "./prisma";
import { sequentialCode } from "./clinic";
import type { Prisma } from "@prisma/client";

export async function nextPrescriptionCode(): Promise<string> {
  return sequentialCode("KT", await prisma.prescription.count());
}

export const prescriptionInclude = {
  items: { orderBy: { sortOrder: "asc" }, include: { product: { select: { id: true, sku: true, name: true } } } },
  customer: { select: { id: true, code: true, fullName: true, phone: true } },
  session: { select: { id: true, code: true, performedAt: true } },
} satisfies Prisma.PrescriptionInclude;

export const PRESCRIPTION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp", ISSUED: "Đã kê", CANCELLED: "Đã hủy",
};

type ItemInput = {
  spaProductId?: string | null; name: string; quantity?: number | null; unit?: string | null;
  usage?: string | null; frequency?: string | null; timing?: string | null; durationDays?: number | null; note?: string | null;
};

/** Dựng nested-create cho items (gán sortOrder theo thứ tự). */
export function buildPrescriptionItems(items: ItemInput[] | undefined): Prisma.PrescriptionItemCreateWithoutPrescriptionInput[] {
  return (items ?? []).filter((i) => i.name?.trim()).map((i, idx) => ({
    spaProductId: i.spaProductId || null,
    name: i.name.trim(),
    quantity: i.quantity != null ? (i.quantity as any) : null,
    unit: i.unit || null,
    usage: i.usage || null,
    frequency: i.frequency || null,
    timing: i.timing || null,
    durationDays: i.durationDays != null ? Number(i.durationDays) : null,
    note: i.note || null,
    sortOrder: idx,
  }));
}
