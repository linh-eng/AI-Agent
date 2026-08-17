// =============================================================================
// Redesign P2 — Protocol compose NHIỀU Service (coexistence với legacy steps).
// Nguyên tắc: Service là SOURCE OF TRUTH cho SOP; ProtocolService chỉ THAM CHIẾU
// + override nhẹ (thứ tự/bắt buộc/điều kiện/ghi đè thời lượng/gợi ý phương án).
// KHÔNG clone ServiceStep vào Protocol → không có double-source.
// =============================================================================
import type { Prisma } from "@prisma/client";

/** include đủ để hiển thị 1 dòng compose kèm PREVIEW SOP của Service (read-only). */
export const protocolServiceInclude = {
  service: {
    select: {
      id: true,
      code: true,
      name: true,
      version: true, // version Service HIỆN HÀNH (live) để so với serviceVersionSnapshot
      durationMinutes: true,
      status: true,
      technologyIds: true,
      steps: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, sortOrder: true, name: true, durationMinutes: true, isRequired: true, warnings: true,
          technologies: { select: { technology: { select: { id: true, name: true } } } },
          options: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isDefault: true } },
          _count: { select: { products: true, technologies: true, options: true } },
        },
      },
    },
  },
} satisfies Prisma.ProtocolServiceInclude;

export const protocolServicesInclude = {
  services: { orderBy: { sortOrder: "asc" }, include: protocolServiceInclude },
} satisfies Prisma.BrandProtocolInclude;

type PSInput = {
  serviceId: string;
  phase?: string | null;
  isRequired?: boolean;
  conditionText?: string | null;
  notes?: string | null;
  durationOverride?: number | null;
  recommendedVariants?: any;
};

/**
 * Dựng mảng nested-create cho ProtocolService. `versionById` = map serviceId→version HIỆN HÀNH
 * để GHI LẠI `serviceVersionSnapshot` (truy vết version lúc gắn — KHÔNG dựng lại SOP cũ; xem P4).
 */
export function buildProtocolServicesCreate(
  services: PSInput[] | undefined,
  versionById: Map<string, number>,
): Prisma.ProtocolServiceCreateWithoutProtocolInput[] | undefined {
  if (!services) return undefined;
  return services.map((s, i) => ({
    sortOrder: i,
    service: { connect: { id: s.serviceId } },
    phase: s.phase ?? null,
    isRequired: s.isRequired ?? true,
    conditionText: s.conditionText ?? null,
    notes: s.notes ?? null,
    durationOverride: s.durationOverride ?? null,
    serviceVersionSnapshot: versionById.get(s.serviceId) ?? null,
    recommendedVariants: s.recommendedVariants ?? undefined,
  }));
}

/** Tổng thời lượng compose = Σ (durationOverride ?? Service.durationMinutes ?? Σ bước SOP). */
export function composeTotalDuration(services: any[] | undefined): number {
  return (services ?? []).reduce((sum, ps) => {
    if (ps.durationOverride != null) return sum + ps.durationOverride;
    const svc = ps.service;
    if (svc?.durationMinutes != null) return sum + svc.durationMinutes;
    const sop = (svc?.steps ?? []).reduce((a: number, st: any) => a + (st.durationMinutes ?? 0), 0);
    return sum + sop;
  }, 0);
}
