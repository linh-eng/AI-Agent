import { prisma } from "@/lib/prisma";

/** Xóa sạch mọi bảng nghiệp vụ (giữ lịch sử migration). Chỉ dùng cho DB test. */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (!rows.length) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let seq = 0;
export const uniq = (p = "t") => `${p}_${Date.now().toString(36)}_${seq++}`;

/** Tạo 1 khách hàng tối thiểu. */
export async function makeCustomer(over: Partial<{ code: string; fullName: string }> = {}) {
  return prisma.customer.create({
    data: { code: over.code ?? uniq("KH"), fullName: over.fullName ?? "Khách Test" },
  });
}

/** Tạo product (kho) + lot có tồn để test tồn kho. */
export async function makeStockedLot(quantity: number) {
  const wh = await prisma.warehouse.create({
    data: { code: uniq("WH"), name: "Kho test", countsAsAvailable: true },
  });
  const product = await prisma.product.create({
    data: { sku: uniq("SKU"), name: "Vật tư test", trackingMode: "LOT", uom: "Cái" },
  });
  const lot = await prisma.lot.create({
    data: { lotNumber: uniq("LOT"), productId: product.id, warehouseId: wh.id, quantity },
  });
  return { wh, product, lot };
}

/** Tạo phác đồ + 1 buổi cho một khách. */
export async function makePlanWithSession(customerId: string) {
  const plan = await prisma.treatmentPlan.create({
    data: { code: uniq("TP"), customerId, name: "Phác đồ test" },
  });
  const session = await prisma.treatmentSession.create({
    data: { planId: plan.id, customerId, sessionNumber: 1, name: "Buổi 1" },
  });
  return { plan, session };
}
