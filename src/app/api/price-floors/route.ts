export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission, requireAuth } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { priceFloorUpsertSchema } from "@/lib/clinic-validation";
import { canSeeFinance, auditLog } from "@/lib/clinic";
import { computeFloor, maxDiscount } from "@/lib/price-floor";

function num(v: unknown): number { return v == null ? 0 : Number(v); }

// Danh sách giá sàn theo dịch vụ (v2 — version). Xem cần pricefloor.read hoặc
// finance.read; cost breakdown/margin CHỈ hiện với finance.read (mục 30).
export const GET = handle(async (req) => {
  const session = await requireAuth();
  const fin = canSeeFinance(session);
  const canRead = fin || session.permissions.includes(PERMISSIONS.PRICEFLOOR_READ);
  if (!canRead) return fail(403, "Không có quyền xem giá sàn");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined; // trạng thái version active
  const effective = url.searchParams.get("effective"); // "1" = chỉ dịch vụ có giá sàn hiệu lực

  const services = await prisma.service.findMany({
    where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
    include: {
      priceFloor: true,
      category: { select: { name: true } },
      floorVersions: { orderBy: { version: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  let rows = services.map((s) => {
    const active = s.floorVersions.find((v) => v.status === "ACTIVE" && (!v.effectiveFrom || v.effectiveFrom <= now) && (!v.effectiveTo || v.effectiveTo >= now)) ?? null;
    const latest = s.floorVersions[0] ?? null;
    const standardPrice = num(s.standardPrice);
    let totalCost = 0, floorPrice = 0, margin = 0, hasFloor = false, version: number | null = null, vstatus: string | null = null, effectiveFrom: Date | null = null, method: string | null = null;

    if (active) {
      hasFloor = true; totalCost = num(active.totalCost); floorPrice = num(active.floorPrice);
      margin = num(active.minMarginPercent); version = active.version; vstatus = active.status;
      effectiveFrom = active.effectiveFrom; method = active.method;
    } else if (s.priceFloor) {
      // fallback v1 (model cũ)
      const c = computeFloor({ laborCost: num(s.priceFloor.laborCost), operationCost: num(s.priceFloor.operationCost), depreciationCost: num(s.priceFloor.depreciationCost), materialCost: num(s.priceFloor.materialCost), roomCost: num(s.priceFloor.roomCost), otherCost: num(s.priceFloor.otherCost), minMarginPercent: num(s.priceFloor.minMarginPercent) });
      hasFloor = true; totalCost = c.totalCost; floorPrice = c.floorPrice; margin = num(s.priceFloor.minMarginPercent); version = null; vstatus = "V1 (cũ)";
    }
    const md = maxDiscount(standardPrice, floorPrice);
    const belowFloor = hasFloor && standardPrice + 1e-6 < floorPrice;

    const row: any = {
      serviceId: s.id, serviceCode: s.code, serviceName: s.name, category: s.category?.name ?? null,
      standardPrice, hasFloor, floorPrice, version, versionStatus: vstatus, effectiveFrom, method,
      maxDiscount: md.amount, maxDiscountPercent: md.percent, belowFloor,
      draftVersion: latest && latest.status !== "ACTIVE" ? latest.version : null,
      // cost/margin nhạy cảm — mask nếu không finance.read
      totalCost: fin ? totalCost : null, minMarginPercent: fin ? margin : null,
    };
    return row;
  });

  if (q) rows = rows.filter((r) => r.serviceCode.toLowerCase().includes(q) || r.serviceName.toLowerCase().includes(q));
  if (status) rows = rows.filter((r) => r.versionStatus === status);
  if (effective === "1") rows = rows.filter((r) => r.version != null);

  return ok(rows);
});

// Giữ tương thích: khai báo nhanh cấu trúc chi phí phẳng (model cũ v1).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.PRICEFLOOR_WRITE);
  const parsed = priceFloorUpsertSchema.parse(await req.json());
  const service = await prisma.service.findUnique({ where: { id: parsed.serviceId }, select: { id: true } });
  if (!service) return fail(404, "Không tìm thấy dịch vụ");

  const data = {
    laborCost: parsed.laborCost, operationCost: parsed.operationCost, depreciationCost: parsed.depreciationCost,
    materialCost: parsed.materialCost, roomCost: parsed.roomCost, otherCost: parsed.otherCost,
    minMarginPercent: parsed.minMarginPercent, note: parsed.note ?? null, updatedBy: session.name,
  };
  const floor = await prisma.servicePriceFloor.upsert({ where: { serviceId: parsed.serviceId }, create: { serviceId: parsed.serviceId, ...data }, update: data });
  const { totalCost, floorPrice } = computeFloor(parsed);
  await auditLog({ userId: session.userId, action: "PRICE_FLOOR_SET", entityType: "ServicePriceFloor", entityId: floor.id, changes: { serviceId: parsed.serviceId, totalCost, floorPrice } });
  return created({ ...floor, totalCost, floorPrice });
});
