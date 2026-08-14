// =============================================================================
// Mục 7 — Giá sàn v2: cost breakdown theo dòng, margin formula, version, snapshot,
// duyệt dưới sàn. Kiểm ở tầng lib (thuần) + service/DB (version) + integration.
// =============================================================================
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq } from "./helpers";
import {
  computeVersionCost, computeFloorPrice, maxDiscount, checkServicePriceFloor,
  activeFloorVersion, proposalOptionFloorTotal, buildDefaultLinesFromService,
} from "@/lib/price-floor";
import { createFloorVersion, transitionFloorVersion, updateFloorVersion, FloorError } from "@/lib/price-floor-service";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";

async function service(price: number, over: Record<string, unknown> = {}) {
  return prisma.service.create({ data: { code: uniq("DV"), name: "DV " + uniq("s"), standardPrice: price, durationMinutes: 60, ...over } });
}

describe("Mục 7.1 — Tính chi phí theo dòng (pure)", () => {
  it("vật tư / nhân sự = số lượng × đơn giá", () => {
    const r = computeVersionCost([
      { category: "MATERIAL", quantity: 2, unitCost: 80_000, calcType: "FIXED" }, // 160k
      { category: "STAFF", quantity: 1, unitCost: 250_000, calcType: "FIXED" }, // 250k
      { category: "STAFF", quantity: 1, unitCost: 500_000, calcType: "FIXED" }, // 500k
    ], 60);
    expect(r.byCategory.MATERIAL).toBe(160_000);
    expect(r.byCategory.STAFF).toBe(750_000);
    expect(r.totalCost).toBe(910_000);
  });

  it("máy theo phút + phòng trọn buổi", () => {
    const r = computeVersionCost([
      { category: "MACHINE", calcType: "PER_MINUTE", calcValue: 5_000, minutes: 60 }, // 300k
      { category: "ROOM", calcType: "PER_SESSION", calcValue: 100_000 }, // 100k
    ], 60);
    expect(r.byCategory.MACHINE).toBe(300_000);
    expect(r.byCategory.ROOM).toBe(100_000);
  });

  it("vận hành % trên CHI PHÍ TRỰC TIẾP (không gồm chính nó)", () => {
    const r = computeVersionCost([
      { category: "MATERIAL", quantity: 1, unitCost: 160_000, calcType: "FIXED" },
      { category: "STAFF", quantity: 1, unitCost: 750_000, calcType: "FIXED" },
      { category: "MACHINE", calcType: "PER_SESSION", calcValue: 300_000 },
      { category: "ROOM", calcType: "PER_SESSION", calcValue: 100_000 },
      { category: "OPERATION", calcType: "PERCENT_DIRECT", calcValue: 10 }, // 10% × 1.310.000 = 131k
    ], 60);
    expect(r.directCost).toBe(1_310_000);
    expect(r.byCategory.OPERATION).toBe(131_000);
    expect(r.totalCost).toBe(1_441_000);
  });

  it("giá sàn theo MARGIN = giá vốn / (1 - biên); MARKUP; MANUAL; làm tròn lên", () => {
    expect(computeFloorPrice({ totalCost: 1_000_000, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1 })).toBe(1_428_572); // ceil(1428571.43)
    expect(computeFloorPrice({ totalCost: 1_000_000, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000 })).toBe(1_429_000);
    expect(computeFloorPrice({ totalCost: 1_000_000, method: "MARKUP", minMarginPercent: 30, roundingUnit: 1000 })).toBe(1_300_000);
    expect(computeFloorPrice({ totalCost: 1_000_000, method: "MANUAL", manualFloorPrice: 1_500_000, roundingUnit: 1000 })).toBe(1_500_000);
  });

  it("chiết khấu tối đa = giá chuẩn - giá sàn + %", () => {
    const md = maxDiscount(2_000_000, 1_600_000);
    expect(md.amount).toBe(400_000);
    expect(md.percent).toBe(20);
  });
});

describe("Mục 7.2 — Version + snapshot + hiệu lực (DB)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  async function publish(id: string) {
    await transitionFloorVersion(id, "submit", { canApprove: true });
    await transitionFloorVersion(id, "approve", { actor: "QL", canApprove: true });
    return transitionFloorVersion(id, "activate", { actor: "QL", canApprove: true });
  }

  it("tạo version tính đúng tổng cost + giá sàn + chiết khấu tối đa (demo RF)", async () => {
    const s = await service(1_800_000);
    const v = await createFloorVersion({
      serviceId: s.id, method: "MARGIN", minMarginPercent: 30, roundingUnit: 1000,
      lines: [
        { category: "MATERIAL", name: "Gel", quantity: 1, unitCost: 250_000, calcType: "FIXED" },
        { category: "STAFF", name: "KTV", quantity: 1, unitCost: 400_000, calcType: "FIXED" },
        { category: "MACHINE", name: "Máy RF", calcType: "PER_SESSION", calcValue: 300_000 },
        { category: "OPERATION", name: "Vận hành", calcType: "FIXED", calcValue: 100_000 },
        { category: "OTHER", name: "Khác", quantity: 1, unitCost: 50_000, calcType: "FIXED" },
      ],
    });
    expect(Number(v.totalCost)).toBe(1_100_000);
    expect(Number(v.floorPrice)).toBe(1_572_000); // ceil(1100000/0.7 /1000)*1000
    expect(Number(v.maxDiscount)).toBe(228_000); // 1.800.000 - 1.572.000
  });

  it("tạo version KHÔNG truyền lines → tự dựng từ định mức + nhân sự dịch vụ", async () => {
    const prod = await prisma.spaProduct.create({ data: { sku: uniq("SKU"), name: "Gel", productType: "PROFESSIONAL", cost: 80_000 } });
    const s = await service(6_000_000, { staffRequirements: [{ role: "KTV-M7", quantity: 1, required: true }] as any });
    await prisma.serviceMaterialStandard.create({ data: { serviceId: s.id, name: "Gel siêu âm", quantity: 2, unit: "tuýp", spaProductId: prod.id, orderIndex: 0 } });
    const lines = await buildDefaultLinesFromService(s.id);
    // Có dòng vật tư (đơn giá từ SpaProduct.cost) + dòng nhân sự theo vai trò.
    const mat = lines.find((l) => l.category === "MATERIAL");
    expect(Number(mat?.unitCost)).toBe(80_000);
    expect(Number(mat?.quantity)).toBe(2);
    expect(lines.some((l) => l.category === "STAFF" && l.name === "KTV-M7")).toBe(true);
    const v = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30 });
    expect(Number(v.materialCost)).toBe(160_000);
  });

  it("chỉ MỘT version ACTIVE tại một thời điểm; activate làm version cũ HẾT HIỆU LỰC", async () => {
    const s = await service(1_800_000);
    const v1 = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_000_000, calcType: "FIXED" }] });
    await publish(v1.id);
    let active = await activeFloorVersion(s.id);
    expect(active?.id).toBe(v1.id);

    const v2 = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30, changeReason: "cost tăng", lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_200_000, calcType: "FIXED" }] });
    await publish(v2.id);
    active = await activeFloorVersion(s.id);
    expect(active?.id).toBe(v2.id);
    const back1 = await prisma.servicePriceFloorVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(back1.status).toBe("EXPIRED");
    expect(back1.effectiveTo).not.toBeNull();
  });

  it("SNAPSHOT bất biến: sửa dịch vụ (giá chuẩn) sau khi ACTIVE KHÔNG đổi version", async () => {
    const s = await service(1_800_000);
    const v = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_100_000, calcType: "FIXED" }] });
    await publish(v.id);
    const floorBefore = Number((await prisma.servicePriceFloorVersion.findUniqueOrThrow({ where: { id: v.id } })).floorPrice);
    // Đổi giá chuẩn dịch vụ mạnh
    await prisma.service.update({ where: { id: s.id }, data: { standardPrice: 9_000_000 } });
    const after = await prisma.servicePriceFloorVersion.findUniqueOrThrow({ where: { id: v.id } });
    expect(Number(after.floorPrice)).toBe(floorBefore); // giá sàn version KHÔNG đổi
    expect(Number(after.standardPriceSnapshot)).toBe(1_800_000); // snapshot giá chuẩn lúc publish
  });

  it("không sửa được version đã ACTIVE", async () => {
    const s = await service(1_800_000);
    const v = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_100_000, calcType: "FIXED" }] });
    await publish(v.id);
    await expect(updateFloorVersion(v.id, { minMarginPercent: 50 })).rejects.toBeInstanceOf(FloorError);
  });

  it("approve/activate cần quyền pricefloor.approve (canApprove=false → 403)", async () => {
    const s = await service(1_800_000);
    const v = await createFloorVersion({ serviceId: s.id, minMarginPercent: 30, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost: 1_100_000, calcType: "FIXED" }] });
    await transitionFloorVersion(v.id, "submit", { canApprove: false });
    await expect(transitionFloorVersion(v.id, "approve", { canApprove: false })).rejects.toMatchObject({ status: 403 });
  });
});

describe("Mục 7.3 — Cảnh báo dưới sàn + integration + RBAC", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  async function activeService(standard: number, unitCost: number, margin = 30) {
    const s = await service(standard);
    const v = await createFloorVersion({ serviceId: s.id, minMarginPercent: margin, lines: [{ category: "MATERIAL", name: "x", quantity: 1, unitCost, calcType: "FIXED" }] });
    await transitionFloorVersion(v.id, "submit", { canApprove: true });
    await transitionFloorVersion(v.id, "approve", { actor: "QL", canApprove: true });
    await transitionFloorVersion(v.id, "activate", { actor: "QL", canApprove: true });
    return { s, floor: Number((await prisma.servicePriceFloorVersion.findUniqueOrThrow({ where: { id: v.id } })).floorPrice), versionId: v.id };
  }

  it("checkServicePriceFloor DÙNG version active (không phải model cũ)", async () => {
    const { s, floor, versionId } = await activeService(1_800_000, 1_100_000); // floor 1.572.000
    const c = await checkServicePriceFloor(s.id, 1_500_000);
    expect(c.hasFloor).toBe(true);
    expect(c.floorPrice).toBe(floor);
    expect(c.floorVersionId).toBe(versionId);
    expect(c.below).toBe(true);
    expect(c.shortfall).toBe(floor - 1_500_000);
  });

  it("cảnh báo giá chuẩn dưới sàn (standard < floor)", async () => {
    const { s } = await activeService(1_000_000, 1_100_000); // floor ~1.572.000 > chuẩn 1.000.000
    const c = await checkServicePriceFloor(s.id, 1_000_000);
    expect(c.floorPrice).toBeGreaterThan(1_000_000);
    expect(c.standardPrice).toBe(1_000_000);
  });

  it("proposalOptionFloorTotal: tổng theo version × số buổi + details để snapshot", async () => {
    const { s, floor } = await activeService(1_800_000, 1_100_000);
    const r = await proposalOptionFloorTotal([{ itemType: "SERVICE", refId: s.id, name: "RF", sessions: 6 }], 9_000_000);
    expect(r.floorTotal).toBe(floor * 6);
    expect(r.below).toBe(true); // 9.000.000 < 6 × 1.572.000 = 9.432.000
    expect(r.details[0].floorPrice).toBe(floor);
    expect(r.details[0].times).toBe(6);
  });

  it("RBAC: phân biệt read/write/approve/override; enforce ở service", () => {
    expect(PERMISSIONS.PRICEFLOOR_READ).toBe("pricefloor.read");
    expect(PERMISSIONS.PRICEFLOOR_APPROVE).toBe("pricefloor.approve");
    // MANAGER có đủ; RECEPTION chỉ read (không approve/override)
    expect(ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.PRICEFLOOR_APPROVE);
    expect(ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.PRICEFLOOR_OVERRIDE);
    expect(ROLE_PERMISSIONS.RECEPTION).toContain(PERMISSIONS.PRICEFLOOR_READ);
    expect(ROLE_PERMISSIONS.RECEPTION).not.toContain(PERMISSIONS.PRICEFLOOR_APPROVE);
    expect(ROLE_PERMISSIONS.RECEPTION).not.toContain(PERMISSIONS.PRICEFLOOR_OVERRIDE);
    // SPECIALIST không có quyền giá sàn
    expect(ROLE_PERMISSIONS.SPECIALIST).not.toContain(PERMISSIONS.PRICEFLOOR_WRITE);
  });
});
