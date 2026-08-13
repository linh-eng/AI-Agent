import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb, uniq } from "./helpers";
import { computeFloor, checkServicePriceFloor } from "@/lib/price-floor";

async function service(price: number) {
  return prisma.service.create({ data: { code: uniq("DV"), name: "DV " + uniq("s"), standardPrice: price } });
}

describe("Giá sàn (mục 25–26)", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("computeFloor: tổng chi phí + biên lợi nhuận", () => {
    const r = computeFloor({ laborCost: 200_000, operationCost: 50_000, materialCost: 100_000, minMarginPercent: 20 });
    expect(r.totalCost).toBe(350_000);
    expect(r.floorPrice).toBe(420_000); // 350k × 1.2
  });

  it("dịch vụ chưa khai báo chi phí → không có sàn, không chặn", async () => {
    const s = await service(1_000_000);
    const c = await checkServicePriceFloor(s.id, 100_000);
    expect(c.hasFloor).toBe(false);
    expect(c.below).toBe(false);
  });

  it("bán DƯỚI giá sàn → below=true + shortfall đúng", async () => {
    const s = await service(1_000_000);
    await prisma.servicePriceFloor.create({ data: { serviceId: s.id, laborCost: 500_000, materialCost: 300_000, minMarginPercent: 0 } });
    // giá sàn = 800k
    const below = await checkServicePriceFloor(s.id, 700_000);
    expect(below.hasFloor).toBe(true);
    expect(below.floorPrice).toBe(800_000);
    expect(below.below).toBe(true);
    expect(below.shortfall).toBe(100_000);
  });

  it("bán BẰNG/TRÊN giá sàn → below=false", async () => {
    const s = await service(1_000_000);
    await prisma.servicePriceFloor.create({ data: { serviceId: s.id, laborCost: 500_000, materialCost: 300_000, minMarginPercent: 0 } });
    const atFloor = await checkServicePriceFloor(s.id, 800_000);
    expect(atFloor.below).toBe(false);
    const above = await checkServicePriceFloor(s.id, 900_000);
    expect(above.below).toBe(false);
  });
});
