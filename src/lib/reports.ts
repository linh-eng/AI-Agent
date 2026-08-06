// =============================================================================
// Báo cáo (mục 7). Các chỉ tiêu dựa trên số lượng/serial (schema chưa có giá
// vốn nên "giá trị" thể hiện bằng số lượng; có thể bổ sung khi thêm trường giá).
// =============================================================================
import { prisma } from "./prisma";
import { getInventory } from "./inventory";
import { SLA_DAYS, addDays, overdueDays } from "./sla";

/** Nhập – Xuất – Tồn theo từng kho trong kỳ. */
export async function reportNXT(from?: Date, to?: Date) {
  const inv = await getInventory();
  const period = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
  const hasPeriod = from || to;

  const inbound = await prisma.stockMovement.groupBy({
    by: ["toWarehouseId"],
    where: { type: "INBOUND", ...(hasPeriod ? { createdAt: period } : {}) },
    _sum: { quantity: true },
  });
  const outbound = await prisma.stockMovement.groupBy({
    by: ["fromWarehouseId"],
    where: { type: "OUTBOUND", ...(hasPeriod ? { createdAt: period } : {}) },
    _sum: { quantity: true },
  });
  const inMap = new Map(inbound.map((r) => [r.toWarehouseId, r._sum.quantity ?? 0]));
  const outMap = new Map(outbound.map((r) => [r.fromWarehouseId, r._sum.quantity ?? 0]));

  return inv.warehouses.map((w) => ({
    code: w.code,
    name: w.name,
    inbound: inMap.get(w.id) ?? 0,
    outbound: outMap.get(w.id) ?? 0,
    onHand: w.onHand,
    countsAsAvailable: w.countsAsAvailable,
  }));
}

/** Báo cáo theo NCC: số serial cung cấp, số lỗi, tỷ lệ lỗi, số vụ RMA. */
export async function reportBySupplier() {
  const suppliers = await prisma.partner.findMany({
    where: { OR: [{ type: "SUPPLIER" }, { type: "BOTH" }] },
    orderBy: { code: "asc" },
  });

  const supplied = await prisma.serial.groupBy({ by: ["supplierId"], _count: { _all: true } });
  const defects = await prisma.serial.groupBy({
    by: ["supplierId"],
    where: { status: { in: ["DAMAGED", "REPLACED"] } },
    _count: { _all: true },
  });
  const rma = await prisma.vendorRma.groupBy({ by: ["vendorId"], _count: { _all: true } });

  const suppliedM = new Map(supplied.map((r) => [r.supplierId, r._count._all]));
  const defectsM = new Map(defects.map((r) => [r.supplierId, r._count._all]));
  const rmaM = new Map(rma.map((r) => [r.vendorId, r._count._all]));

  return suppliers.map((s) => {
    const total = suppliedM.get(s.id) ?? 0;
    const defect = defectsM.get(s.id) ?? 0;
    return {
      code: s.code,
      name: s.name,
      supplied: total,
      defects: defect,
      defectRate: total > 0 ? Math.round((defect / total) * 1000) / 10 : 0,
      rmaCount: rmaM.get(s.id) ?? 0,
    };
  });
}

/** Tồn đọng quá hạn: K-HH (15 ngày) và K-BH-NCC (SLA hãng). */
export async function reportOverdue() {
  const now = new Date();
  const damaged = await prisma.damagedItem.findMany({
    where: { resolution: "PENDING" },
  });
  const dmgSerialIds = damaged.map((d) => d.serialId).filter(Boolean) as string[];
  const rmas = await prisma.vendorRma.findMany({ where: { status: "SENT" } });
  const rmaSerialIds = rmas.map((r) => r.serialId).filter(Boolean) as string[];
  const serials = await prisma.serial.findMany({
    where: { id: { in: [...dmgSerialIds, ...rmaSerialIds] } },
    select: { id: true, serialNumber: true, product: { select: { name: true } } },
  });
  const sMap = new Map(serials.map((s) => [s.id, s]));

  const khh = damaged
    .map((d) => ({ serialNumber: d.serialId ? sMap.get(d.serialId)?.serialNumber : "—", product: d.serialId ? sMap.get(d.serialId)?.product.name : "", days: overdueDays(d.dueDate, now) }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days);

  const kbhncc = rmas
    .map((r) => {
      const due = r.sentDate ? addDays(r.sentDate, r.slaDays ?? SLA_DAYS.VENDOR_RMA) : null;
      return { number: r.number, serialNumber: r.serialId ? sMap.get(r.serialId)?.serialNumber : "—", days: due ? overdueDays(due, now) : 0 };
    })
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days);

  return { khh, kbhncc };
}

/** Hiệu quả lắp ráp: số WO hoàn thành, tỷ lệ QC fail. */
export async function reportAssembly() {
  const [totalWo, doneWo, qcPass, qcFail] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.count({ where: { status: "DONE" } }),
    prisma.qcReport.count({ where: { type: "OUTPUT", result: "PASS" } }),
    prisma.qcReport.count({ where: { type: "OUTPUT", result: "FAIL" } }),
  ]);
  const totalQc = qcPass + qcFail;
  return {
    totalWo,
    doneWo,
    qcPass,
    qcFail,
    qcFailRate: totalQc > 0 ? Math.round((qcFail / totalQc) * 1000) / 10 : 0,
  };
}

/** Bảo hành tổng quan + đòi BH ngược NCC chưa thu hồi. */
export async function reportWarranty() {
  const now = new Date();
  const soon = addDays(now, 60);
  const [openIntakes, openRma, openClaims, expiringSoon] = await Promise.all([
    prisma.warrantyIntake.count({ where: { status: "OPEN" } }),
    prisma.vendorRma.count({ where: { status: "SENT" } }),
    prisma.rmaTicket.count({ where: { isVendorClaim: true, status: "OPEN" } }),
    prisma.warranty.count({ where: { provider: "THNG", endDate: { gte: now, lte: soon } } }),
  ]);
  return { openIntakes, openRma, openClaims, expiringSoon };
}

/** Kết quả rã máy: số lệnh đã rã, linh kiện thu hồi (K-TMAY) vs bỏ đi (K-TL). */
export async function reportDisassembly() {
  const executed = await prisma.disassemblyOrder.count({ where: { executedAt: { not: null } } });
  const recovered = await prisma.stockMovement.count({
    where: { type: "DISASSEMBLY", note: { contains: "thu hồi" } },
  });
  const scrapped = await prisma.stockMovement.count({
    where: { type: "DISASSEMBLY", note: { contains: "hỏng" } },
  });
  return { executed, recovered, scrapped };
}

export async function reportSummary() {
  const [nxt, bySupplier, overdue, assembly, warranty, disassembly] = await Promise.all([
    reportNXT(),
    reportBySupplier(),
    reportOverdue(),
    reportAssembly(),
    reportWarranty(),
    reportDisassembly(),
  ]);
  return { nxt, bySupplier, overdue, assembly, warranty, disassembly };
}
