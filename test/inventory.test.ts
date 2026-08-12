import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyMaterialMovement } from "@/lib/material-service";
import { resetDb, makeCustomer, makeStockedLot, makePlanWithSession } from "./helpers";

async function materialLinkedToLot(lotId: string, sessionId: string, unitCost = 1000) {
  return prisma.sessionMaterial.create({
    data: { sessionId, name: "Vật tư", lotId, unitCost, uom: "Cái" },
  });
}

describe("Module 8 — tồn kho thật", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("RESERVE→ISSUE→CONSUME trừ tồn đúng và tính chi phí buổi", async () => {
    const cust = await makeCustomer();
    const { session } = await makePlanWithSession(cust.id);
    const { lot } = await makeStockedLot(10);
    const sm = await materialLinkedToLot(lot.id, session.id, 5000);

    await applyMaterialMovement(sm.id, { type: "RESERVE", quantity: 3 });
    let lotRow = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(lotRow!.reservedQty).toBe(3);
    expect(lotRow!.quantity).toBe(10); // reserve chưa trừ tồn vật lý

    await applyMaterialMovement(sm.id, { type: "ISSUE", quantity: 3 });
    lotRow = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(lotRow!.quantity).toBe(7); // đã xuất 3
    expect(lotRow!.reservedQty).toBe(0); // hold được giải phóng

    await applyMaterialMovement(sm.id, { type: "CONSUME", quantity: 3 });
    const smRow = await prisma.sessionMaterial.findUnique({ where: { id: sm.id } });
    expect(Number(smRow!.consumedQty)).toBe(3);

    const sess = await prisma.treatmentSession.findUnique({ where: { id: session.id } });
    expect(Number(sess!.materialCost)).toBe(15000); // 3 × 5000
    expect(Number(sess!.actualCost)).toBe(15000); // actualCost trống -> gán = materialCost

    // Có 1 StockMovement OUTBOUND ledger cho lần ISSUE
    const moves = await prisma.stockMovement.findMany({ where: { lotId: lot.id } });
    expect(moves.filter((m) => m.type === "OUTBOUND").length).toBe(1);
    expect(moves[0].quantity).toBe(3);
  });

  it("chặn xuất vượt tồn (không cho tồn âm)", async () => {
    const cust = await makeCustomer();
    const { session } = await makePlanWithSession(cust.id);
    const { lot } = await makeStockedLot(2);
    const sm = await materialLinkedToLot(lot.id, session.id);

    await expect(applyMaterialMovement(sm.id, { type: "ISSUE", quantity: 5 })).rejects.toThrow(/Không đủ tồn/);
    const lotRow = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(lotRow!.quantity).toBe(2); // không đổi
  });

  it("RETURN cộng lại tồn và không vượt phần đã xuất", async () => {
    const cust = await makeCustomer();
    const { session } = await makePlanWithSession(cust.id);
    const { lot } = await makeStockedLot(10);
    const sm = await materialLinkedToLot(lot.id, session.id);

    await applyMaterialMovement(sm.id, { type: "ISSUE", quantity: 4 });
    await applyMaterialMovement(sm.id, { type: "CONSUME", quantity: 1 });
    await applyMaterialMovement(sm.id, { type: "RETURN", quantity: 3 }); // 4 xuất - 1 dùng = 3 hoàn được
    const lotRow = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(lotRow!.quantity).toBe(9); // 10 - 4 + 3

    await expect(applyMaterialMovement(sm.id, { type: "RETURN", quantity: 1 })).rejects.toThrow(/hoàn/);
  });

  it("đồng thời: 2 lệnh ISSUE không gây oversell (khóa dòng lot)", async () => {
    const cust = await makeCustomer();
    const { session } = await makePlanWithSession(cust.id);
    const { lot } = await makeStockedLot(5);
    const sm1 = await materialLinkedToLot(lot.id, session.id);
    const sm2 = await materialLinkedToLot(lot.id, session.id);

    const results = await Promise.allSettled([
      applyMaterialMovement(sm1.id, { type: "ISSUE", quantity: 4 }),
      applyMaterialMovement(sm2.id, { type: "ISSUE", quantity: 4 }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1); // chỉ 1 lệnh thành công
    expect(failed).toBe(1);
    const lotRow = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(lotRow!.quantity).toBe(1); // 5 - 4, KHÔNG âm
    expect(lotRow!.quantity).toBeGreaterThanOrEqual(0);
  });

  it("vật tư không gắn lô: chỉ tính chi phí, không đụng tồn", async () => {
    const cust = await makeCustomer();
    const { session } = await makePlanWithSession(cust.id);
    const sm = await prisma.sessionMaterial.create({
      data: { sessionId: session.id, name: "SP chuyên nghiệp", isProfessional: true, unitCost: 2000 },
    });
    await applyMaterialMovement(sm.id, { type: "CONSUME", quantity: 2 });
    const sess = await prisma.treatmentSession.findUnique({ where: { id: session.id } });
    expect(Number(sess!.materialCost)).toBe(4000);
  });
});
