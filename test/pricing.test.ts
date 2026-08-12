import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolvePrice, priceTypesForCustomer, resolveItemPricing } from "@/lib/pricing";
import { resetDb, uniq, makeCustomer } from "./helpers";

async function priceRule(targetId: string, priceType: string, price: number, over: any = {}) {
  return prisma.priceRule.create({
    data: { targetType: "SERVICE", targetId, priceType: priceType as any, price, ...over },
  });
}

describe("Module 9 — price resolution", () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("ưu tiên CAMPAIGN > STANDARD", async () => {
    const svc = uniq("svc");
    await priceRule(svc, "STANDARD", 1000);
    await priceRule(svc, "CAMPAIGN", 700);
    const r = await resolvePrice("SERVICE", svc, {});
    expect(r?.price).toBe(700);
    expect(r?.priceType).toBe("CAMPAIGN");
  });

  it("khách thường KHÔNG được giá MEMBER/VIP", async () => {
    const svc = uniq("svc");
    await priceRule(svc, "STANDARD", 1000);
    await priceRule(svc, "MEMBER", 800);
    const regular = await resolvePrice("SERVICE", svc, { types: priceTypesForCustomer(null) });
    expect(regular?.price).toBe(1000); // chỉ STANDARD
    const member = await resolvePrice("SERVICE", svc, { types: priceTypesForCustomer("MEMBER") });
    expect(member?.price).toBe(800); // được MEMBER
  });

  it("bỏ qua giá đã hết hiệu lực", async () => {
    const svc = uniq("svc");
    await priceRule(svc, "STANDARD", 1000, { effectiveTo: new Date("2000-01-01") });
    const r = await resolvePrice("SERVICE", svc, {});
    expect(r).toBeNull();
  });

  it("resolveItemPricing fallback giá niêm yết + snapshot giá vốn", async () => {
    const service = await prisma.service.create({
      data: { code: uniq("DV"), name: "DV", standardPrice: 500, expectedCost: 120 },
    });
    const r = await resolveItemPricing("SERVICE", service.id, null);
    expect(r.unitPrice).toBe(500); // fallback standardPrice
    expect(r.unitCost).toBe(120); // giá vốn nội bộ
  });

  it("SNAPSHOT: đổi giá catalog sau KHÔNG đổi giá đã chốt của hạng mục báo giá", async () => {
    const cust = await makeCustomer({ code: uniq("KH") });
    const service = await prisma.service.create({ data: { code: uniq("DV"), name: "DV", standardPrice: 1000 } });

    // Lập báo giá: giá được snapshot = 1000
    const proposal = await prisma.treatmentProposal.create({
      data: {
        code: uniq("PROP"), customerId: cust.id, title: "BG",
        options: { create: [{ kind: "RECOMMENDED", name: "PA", items: { create: [{ itemType: "SERVICE", refId: service.id, name: "DV", quantity: 1, unitPrice: 1000 }] } }] },
      },
      include: { options: { include: { items: true } } },
    });
    const itemId = proposal.options[0].items[0].id;

    // Đổi giá dịch vụ về sau
    await prisma.service.update({ where: { id: service.id }, data: { standardPrice: 3000 } });
    await priceRule(service.id, "STANDARD", 3000);

    // Giá đã chốt trong ProposalItem không đổi
    const item = await prisma.proposalItem.findUnique({ where: { id: itemId } });
    expect(Number(item!.unitPrice)).toBe(1000);
    // Nhưng resolve giá hiện tại trả về giá mới
    const now = await resolvePrice("SERVICE", service.id, {});
    expect(now?.price).toBe(3000);
  });
});
