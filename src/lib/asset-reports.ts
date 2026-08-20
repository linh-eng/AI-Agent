// =============================================================================
// Báo cáo tổng hợp cho phân hệ "Quản lý Tài sản" (nhiều tài sản, theo thời gian):
//   - getDepreciationReport: khấu hao lũy kế/còn lại từng tài sản + bảng theo năm
//     gộp toàn danh mục (báo cáo quá trình khấu hao theo thời gian).
//   - getMaintenanceSchedule: lịch bảo trì (gần nhất / kế tiếp / trạng thái đến hạn).
//   - getAssetDebts: công nợ tài sản (hợp đồng / đã trả / còn nợ / tiến độ).
// Dùng lại computeDepreciation (thuần TS) để số liệu khớp trang chi tiết tài sản.
// =============================================================================
import { prisma } from "./prisma";
import { computeDepreciation, type DepMethod } from "./depreciation";

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function daysBetween(target: Date, from: Date): number {
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86400000);
}

// ---------------------------------------------------------------------------
// (a) Khấu hao — tổng hợp toàn danh mục
// ---------------------------------------------------------------------------
export interface DepReportRow {
  id: string;
  code: string;
  name: string;
  sku: string;
  method: DepMethod;
  cost: number;
  accumulated: number;
  remaining: number;
  percent: number;
  monthly: number;
  endDate: string | null;
  // dữ liệu gốc để chỉnh sửa
  salvageValue: number;
  months: number | null;
  depreciationStart: string | null;
  purchaseDate: string | null;
  totalUnits: number | null;
}
export interface DepYearAgg {
  year: number;
  depreciation: number;
  accumulated: number;
  remaining: number;
}

export async function getDepreciationReport(asOf = new Date()) {
  const assets = await prisma.asset.findMany({
    where: { cost: { not: null, gt: 0 } },
    include: {
      product: { select: { sku: true, name: true } },
      depreciationUsages: { select: { usageDate: true, units: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows: DepReportRow[] = [];
  const yearMap = new Map<number, number>(); // năm -> tổng khấu hao toàn danh mục
  let totalCost = 0;

  for (const a of assets) {
    const method = (a.depreciationMethod ?? "STRAIGHT_LINE") as DepMethod;
    const dep = computeDepreciation(
      {
        cost: a.cost!,
        salvage: a.salvageValue ?? 0,
        months: a.depreciationMonths ?? 0,
        start: a.depreciationStart ?? a.purchaseDate ?? a.createdAt,
        method,
        totalUnits: a.depreciationTotalUnits ?? null,
        usages: a.depreciationUsages.map((u) => ({ date: u.usageDate, units: u.units })),
      },
      asOf,
    );
    if (!dep) continue;
    totalCost += a.cost!;
    rows.push({
      id: a.id,
      code: a.code,
      name: a.product.name,
      sku: a.product.sku,
      method,
      cost: a.cost!,
      accumulated: dep.accumulated,
      remaining: dep.remaining,
      percent: dep.percent,
      monthly: dep.monthly,
      endDate: dep.endDate ? dep.endDate.toISOString() : null,
      salvageValue: a.salvageValue ?? 0,
      months: a.depreciationMonths ?? null,
      depreciationStart: a.depreciationStart ? a.depreciationStart.toISOString() : null,
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString() : null,
      totalUnits: a.depreciationTotalUnits ?? null,
    });
    for (const y of dep.yearly) yearMap.set(y.year, (yearMap.get(y.year) ?? 0) + y.depreciation);
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
  let acc = 0;
  const yearly: DepYearAgg[] = years.map((year) => {
    const depreciation = Math.round(yearMap.get(year) ?? 0);
    acc += depreciation;
    return { year, depreciation, accumulated: Math.round(acc), remaining: Math.round(totalCost - acc) };
  });

  const totals = {
    count: rows.length,
    cost: Math.round(totalCost),
    accumulated: Math.round(rows.reduce((s, r) => s + r.accumulated, 0)),
    remaining: Math.round(rows.reduce((s, r) => s + r.remaining, 0)),
  };
  return { asOf: asOf.toISOString(), rows, yearly, totals };
}

// ---------------------------------------------------------------------------
// (b) Lịch bảo trì
// ---------------------------------------------------------------------------
export type MaintStatus = "overdue" | "due" | "ok";
export interface MaintScheduleRow {
  id: string;
  code: string;
  name: string;
  sku: string;
  cycleMonths: number;
  lastDate: string | null;
  nextDate: string | null;
  days: number | null; // số ngày tới hạn kế tiếp (âm = quá hạn)
  status: MaintStatus;
  vendor: string | null;
}

export async function getMaintenanceSchedule(asOf = new Date(), dueWithinDays = 14) {
  const assets = await prisma.asset.findMany({
    where: { status: { not: "RETIRED" }, maintenanceCycleMonths: { not: null, gt: 0 } },
    include: {
      product: { select: { sku: true, name: true } },
      maintenance: { orderBy: { performedAt: "desc" }, take: 1, select: { performedAt: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows: MaintScheduleRow[] = assets.map((a) => {
    const last = a.maintenance[0]?.performedAt ?? null;
    const base = last ?? a.purchaseDate ?? null;
    const next = base ? addMonths(base, a.maintenanceCycleMonths!) : null;
    const days = next ? daysBetween(next, asOf) : null;
    let status: MaintStatus = "ok";
    if (days != null) status = days < 0 ? "overdue" : days <= dueWithinDays ? "due" : "ok";
    return {
      id: a.id,
      code: a.code,
      name: a.product.name,
      sku: a.product.sku,
      cycleMonths: a.maintenanceCycleMonths!,
      lastDate: last ? last.toISOString() : null,
      nextDate: next ? next.toISOString() : null,
      days,
      status,
      vendor: a.warrantyVendor ?? null,
    };
  });

  // Sắp xếp: quá hạn/đến hạn trước (theo số ngày tăng dần), chưa có mốc xếp cuối.
  rows.sort((a, b) => {
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return a.days - b.days;
  });

  const summary = {
    overdue: rows.filter((r) => r.status === "overdue").length,
    due: rows.filter((r) => r.status === "due").length,
    ok: rows.filter((r) => r.status === "ok").length,
    total: rows.length,
  };
  return { asOf: asOf.toISOString(), rows, summary };
}

// ---------------------------------------------------------------------------
// (c) Công nợ tài sản
// ---------------------------------------------------------------------------
export interface DebtRow {
  id: string;
  code: string;
  name: string;
  sku: string;
  managementType: string | null;
  contract: number;
  paid: number;
  remaining: number;
  percent: number;
  count: number;
  lastPaid: string | null;
}

export async function getAssetDebts() {
  const assets = await prisma.asset.findMany({
    where: { OR: [{ contractValue: { not: null, gt: 0 } }, { payments: { some: {} } }] },
    include: {
      product: { select: { sku: true, name: true } },
      payments: { select: { amount: true, paidDate: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows: DebtRow[] = assets.map((a) => {
    const paid = a.payments.reduce((s, p) => s + p.amount, 0);
    const contract = a.contractValue ?? 0;
    const remaining = Math.max(0, Math.round(contract - paid));
    const percent = contract > 0 ? Math.min(100, Math.round((paid / contract) * 100)) : paid > 0 ? 100 : 0;
    const lastPaid = a.payments.length
      ? a.payments.reduce((m, p) => (p.paidDate > m ? p.paidDate : m), a.payments[0].paidDate)
      : null;
    return {
      id: a.id,
      code: a.code,
      name: a.product.name,
      sku: a.product.sku,
      managementType: a.managementType ?? null,
      contract: Math.round(contract),
      paid: Math.round(paid),
      remaining,
      percent,
      count: a.payments.length,
      lastPaid: lastPaid ? lastPaid.toISOString() : null,
    };
  });

  const totals = {
    count: rows.length,
    contract: rows.reduce((s, r) => s + r.contract, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
  };
  return { rows, totals };
}
