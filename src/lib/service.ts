// =============================================================================
// Dịch vụ (mục 3) — tiện ích tách dữ liệu ghi (materials nested) + làm giàu chi
// tiết (giải tên công nghệ/protocol + tóm tắt giá sàn).
// =============================================================================
import { prisma } from "./prisma";
import { computeFloor } from "./price-floor";

type ServiceInput = {
  materials?: any[];
  staffRequirements?: any;
  resourceRequirements?: any;
  status?: "ACTIVE" | "PAUSED" | "ARCHIVED";
  [k: string]: any;
};

/** Tách phần materials khỏi payload; đồng bộ isActive theo status. */
export function splitServiceInput(parsed: ServiceInput): { data: Record<string, any>; materials: any[] | undefined } {
  const { materials, ...rest } = parsed;
  const data: Record<string, any> = { ...rest };
  if (rest.status !== undefined) data.isActive = rest.status === "ACTIVE";
  // Json fields đi thẳng vào Prisma (staffRequirements/resourceRequirements).
  return { data, materials };
}

export function materialCreateRows(materials: any[] | undefined) {
  if (!materials) return undefined;
  return materials.map((m, i) => ({
    name: m.name,
    quantity: m.quantity ?? 1,
    unit: m.unit,
    note: m.note ?? null,
    required: m.required ?? false,
    spaProductId: m.spaProductId ?? null,
    usageMaterialId: m.usageMaterialId ?? null,
    orderIndex: i,
  }));
}

/** Giải tên công nghệ / protocol từ id (soft ref) + tóm tắt giá sàn của dịch vụ. */
export async function enrichServiceDetail(service: any) {
  const [techs, protos, floor] = await Promise.all([
    service.technologyIds?.length
      ? prisma.technology.findMany({ where: { id: { in: service.technologyIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    service.protocolIds?.length
      ? prisma.brandProtocol.findMany({ where: { id: { in: service.protocolIds } }, select: { id: true, name: true, code: true } })
      : Promise.resolve([]),
    prisma.servicePriceFloor.findUnique({ where: { serviceId: service.id } }),
  ]);
  const floorSummary = floor
    ? {
        hasFloor: true,
        minMarginPercent: Number(floor.minMarginPercent),
        ...computeFloor({
          laborCost: Number(floor.laborCost), operationCost: Number(floor.operationCost),
          depreciationCost: Number(floor.depreciationCost), materialCost: Number(floor.materialCost),
          roomCost: Number(floor.roomCost), otherCost: Number(floor.otherCost), minMarginPercent: Number(floor.minMarginPercent),
        }),
      }
    : { hasFloor: false, totalCost: 0, floorPrice: 0, minMarginPercent: 0 };
  return { technologies: techs, protocols: protos, floorSummary };
}
