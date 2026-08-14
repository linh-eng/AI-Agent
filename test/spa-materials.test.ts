// =============================================================================
// Test module VẬT TƯ SPA — 2 khái niệm.
//   * Kho vật tư sử dụng: trừ tồn còn lại đúng + phân bổ chi phí theo giá vốn lọ,
//     cộng vào session.materialCost; chặn dùng vượt tồn.
//   * Vật tư khách hàng: cộng đã dùng, chặn vượt số cấp, CHẶN dùng chéo khách.
// Kịch bản JetPeel: 100ml, cost 2.000.000 → A 5ml, B 7ml, A 6ml → còn 82ml.
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeFromContainer, consumeFromCustomerMaterial, MaterialError } from "@/lib/spa-material-service";
import { resetDb, uniq, makeCustomer, makePlanWithSession } from "./helpers";

beforeAll(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function makeJetPeel() {
  const m = await prisma.usageMaterial.create({ data: { code: uniq("VT"), name: "JetPeel", unit: "ml", expectedPerSession: 5 } });
  const c = await prisma.materialContainer.create({
    data: { usageMaterialId: m.id, containerNo: uniq("JET"), initialQty: 100, remainingQty: 100, unit: "ml", costSnapshot: 2_000_000, status: "IN_USE" },
  });
  return c;
}

describe("Kho vật tư sử dụng (container dùng chung)", () => {
  it("JetPeel: A 5ml, B 7ml, A 6ml → còn 82ml; chi phí phân bổ đúng (20.000₫/ml)", async () => {
    const container = await makeJetPeel();
    const A = await makeCustomer();
    const B = await makeCustomer();
    const sA1 = (await makePlanWithSession(A.id)).session;
    const sB1 = (await makePlanWithSession(B.id)).session;
    const sA2 = (await makePlanWithSession(A.id)).session;

    const u1 = await consumeFromContainer(container.id, { sessionId: sA1.id, quantity: 5 });
    const u2 = await consumeFromContainer(container.id, { sessionId: sB1.id, quantity: 7 });
    const u3 = await consumeFromContainer(container.id, { sessionId: sA2.id, quantity: 6 });

    const after = await prisma.materialContainer.findUniqueOrThrow({ where: { id: container.id } });
    expect(Number(after.remainingQty)).toBe(82);
    // đơn giá = 2.000.000 / 100 = 20.000/ml
    expect(Number(u1.costAllocated)).toBe(100_000);
    expect(Number(u2.costAllocated)).toBe(140_000);
    expect(Number(u3.costAllocated)).toBe(120_000);
    // TỒN TRƯỚC / TỒN SAU từng lần (chạy nối tiếp trên cùng container) — mục 15,18
    expect([Number(u1.remainingBefore), Number(u1.remainingAfter)]).toEqual([100, 95]);
    expect([Number(u2.remainingBefore), Number(u2.remainingAfter)]).toEqual([95, 88]);
    expect([Number(u3.remainingBefore), Number(u3.remainingAfter)]).toEqual([88, 82]);
    // session.materialCost của buổi A1 = 100k
    const sess = await prisma.treatmentSession.findUniqueOrThrow({ where: { id: sA1.id } });
    expect(Number(sess.materialCost)).toBe(100_000);
  });

  it("chặn dùng vượt tồn còn lại", async () => {
    const container = await makeJetPeel();
    await expect(consumeFromContainer(container.id, { quantity: 150 })).rejects.toBeInstanceOf(MaterialError);
  });
});

describe("Vật tư khách hàng (riêng từng khách)", () => {
  it("cấp 10, buổi 1 dùng 3, buổi 2 dùng 2 → còn 5", async () => {
    const A = await makeCustomer();
    const s1 = (await makePlanWithSession(A.id)).session;
    const s2 = (await makePlanWithSession(A.id)).session;
    const mat = await prisma.customerMaterial.create({ data: { code: uniq("VTKH"), customerId: A.id, name: "Kit", unit: "đv", allocatedQty: 10 } });
    await consumeFromCustomerMaterial(mat.id, { sessionId: s1.id, quantity: 3 });
    await consumeFromCustomerMaterial(mat.id, { sessionId: s2.id, quantity: 2 });
    const after = await prisma.customerMaterial.findUniqueOrThrow({ where: { id: mat.id } });
    expect(Number(after.usedQty)).toBe(5);
    expect(Number(after.allocatedQty) - Number(after.usedQty)).toBe(5);
  });

  it("CHẶN dùng chéo khách: vật tư của A không dùng được cho buổi của B", async () => {
    const A = await makeCustomer();
    const B = await makeCustomer();
    const sB = (await makePlanWithSession(B.id)).session;
    const mat = await prisma.customerMaterial.create({ data: { code: uniq("VTKH"), customerId: A.id, name: "Kit", unit: "đv", allocatedQty: 10 } });
    await expect(consumeFromCustomerMaterial(mat.id, { sessionId: sB.id, quantity: 1 })).rejects.toThrow(/khách khác/);
    // Không thay đổi usedQty
    const after = await prisma.customerMaterial.findUniqueOrThrow({ where: { id: mat.id } });
    expect(Number(after.usedQty)).toBe(0);
  });

  it("chặn dùng vượt số đã cấp", async () => {
    const A = await makeCustomer();
    const mat = await prisma.customerMaterial.create({ data: { code: uniq("VTKH"), customerId: A.id, name: "Kit", unit: "đv", allocatedQty: 3 } });
    await expect(consumeFromCustomerMaterial(mat.id, { quantity: 5 })).rejects.toThrow(/Vượt số đã cấp/);
  });
});
