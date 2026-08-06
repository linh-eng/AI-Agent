// =============================================================================
// Tồn kho realtime (M5) — tính tồn theo kho & theo sản phẩm + cảnh báo.
//
// QUY TẮC TỒN KHẢ DỤNG (bám mục 3a + Phase 3):
//   khả dụng = serial status IN_STOCK
//              AND parentSerialId IS NULL   (không nằm trong máy lắp ráp)
//              AND warehouse.countsAsAvailable = true
// =============================================================================
import { prisma } from "./prisma";
import type { SerialStatus } from "@prisma/client";

/** Trạng thái coi là còn nằm vật lý trong kho (tồn thực tế). */
const ON_HAND_STATUSES: SerialStatus[] = [
  "IN_STOCK",
  "RESERVED",
  "WIP",
  "IN_WARRANTY_INTAKE",
  "IN_REPAIR",
  "DAMAGED",
];

const AGING_DAYS = 180; // hàng tồn lâu
const WARRANTY_SOON_DAYS = 60; // BH NCC sắp hết

export interface WarehouseStock {
  id: string;
  code: string;
  name: string;
  countsAsAvailable: boolean;
  onHand: number; // serial còn trong kho (không tính linh kiện trong máy)
  available: number; // serial khả dụng bán
  reserved: number;
  wip: number;
  lotQty: number;
}

export interface ProductStock {
  id: string;
  sku: string;
  name: string;
  trackingMode: string;
  minStock: number | null;
  available: number;
  onHand: number;
  reserved: number;
  wip: number;
  belowMin: boolean;
}

export async function getInventory() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
  const availableWhIds = warehouses.filter((w) => w.countsAsAvailable).map((w) => w.id);

  // --- Gom theo kho + trạng thái (chỉ serial không nằm trong máy) ---
  const byWhStatus = await prisma.serial.groupBy({
    by: ["warehouseId", "status"],
    where: { parentSerialId: null },
    _count: { _all: true },
  });
  const lotByWh = await prisma.lot.groupBy({
    by: ["warehouseId"],
    _sum: { quantity: true },
  });
  const lotMap = new Map(lotByWh.map((l) => [l.warehouseId, l._sum.quantity ?? 0]));

  const whStock: WarehouseStock[] = warehouses.map((w) => {
    const rows = byWhStatus.filter((r) => r.warehouseId === w.id);
    const cnt = (s: SerialStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
    const onHand = rows
      .filter((r) => ON_HAND_STATUSES.includes(r.status))
      .reduce((a, r) => a + r._count._all, 0);
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      countsAsAvailable: w.countsAsAvailable,
      onHand,
      available: w.countsAsAvailable ? cnt("IN_STOCK") : 0,
      reserved: cnt("RESERVED"),
      wip: cnt("WIP"),
      lotQty: lotMap.get(w.id) ?? 0,
    };
  });

  // --- Gom theo sản phẩm ---
  const products = await prisma.product.findMany({ orderBy: { sku: "asc" } });

  const availByProduct = await prisma.serial.groupBy({
    by: ["productId"],
    where: { status: "IN_STOCK", parentSerialId: null, warehouseId: { in: availableWhIds } },
    _count: { _all: true },
  });
  const onHandByProduct = await prisma.serial.groupBy({
    by: ["productId"],
    where: { status: { in: ON_HAND_STATUSES }, parentSerialId: null },
    _count: { _all: true },
  });
  const reservedByProduct = await prisma.serial.groupBy({
    by: ["productId"],
    where: { status: "RESERVED", parentSerialId: null },
    _count: { _all: true },
  });
  const wipByProduct = await prisma.serial.groupBy({
    by: ["productId"],
    where: { status: "WIP", parentSerialId: null },
    _count: { _all: true },
  });
  const m = (arr: typeof availByProduct) =>
    new Map(arr.map((r) => [r.productId, r._count._all]));
  const availM = m(availByProduct);
  const onHandM = m(onHandByProduct);
  const resM = m(reservedByProduct);
  const wipM = m(wipByProduct);

  const productStock: ProductStock[] = products.map((p) => {
    const available = availM.get(p.id) ?? 0;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      trackingMode: p.trackingMode,
      minStock: p.minStock,
      available,
      onHand: onHandM.get(p.id) ?? 0,
      reserved: resM.get(p.id) ?? 0,
      wip: wipM.get(p.id) ?? 0,
      belowMin: p.minStock != null && available < p.minStock,
    };
  });

  const alerts = await getAlerts(productStock, availableWhIds);

  return { warehouses: whStock, products: productStock, alerts };
}

async function getAlerts(products: ProductStock[], availableWhIds: string[]) {
  const now = new Date();
  const agingBefore = new Date(now.getTime() - AGING_DAYS * 86400000);
  const warrantyBefore = new Date(now.getTime() + WARRANTY_SOON_DAYS * 86400000);

  // Tồn tối thiểu
  const lowStock = products.filter((p) => p.belowMin);

  // Hàng tồn lâu (IN_STOCK, không trong máy, quá AGING_DAYS)
  const agingSerials = await prisma.serial.findMany({
    where: { status: "IN_STOCK", parentSerialId: null, createdAt: { lt: agingBefore } },
    take: 100,
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true } },
    },
  });
  const aging = agingSerials.map((s) => ({
    serialNumber: s.serialNumber,
    product: s.product.name,
    warehouse: s.warehouse.code,
    days: Math.floor((now.getTime() - s.createdAt.getTime()) / 86400000),
  }));

  // Linh kiện sắp hết BH NCC khi CÒN nằm trong kho khả dụng
  const warrantyRows = await prisma.warranty.findMany({
    where: {
      provider: "VENDOR",
      endDate: { lte: warrantyBefore },
      serial: { status: "IN_STOCK", parentSerialId: null, warehouseId: { in: availableWhIds } },
    },
    take: 100,
    orderBy: { endDate: "asc" },
    include: {
      serial: {
        select: { serialNumber: true, product: { select: { name: true } }, warehouse: { select: { code: true } } },
      },
    },
  });
  const warrantyExpiring = warrantyRows
    .filter((w) => w.serial)
    .map((w) => ({
      serialNumber: w.serial!.serialNumber,
      product: w.serial!.product.name,
      warehouse: w.serial!.warehouse.code,
      endDate: w.endDate,
      expired: !!w.endDate && w.endDate < now,
    }));

  return { lowStock, aging, warrantyExpiring };
}

/** Số lượng khả dụng của 1 sản phẩm (dùng cho chặn bán vượt tồn ở Phase sau). */
export async function getAvailableQty(productId: string): Promise<number> {
  const availableWhIds = (
    await prisma.warehouse.findMany({ where: { countsAsAvailable: true }, select: { id: true } })
  ).map((w) => w.id);
  return prisma.serial.count({
    where: { productId, status: "IN_STOCK", parentSerialId: null, warehouseId: { in: availableWhIds } },
  });
}
