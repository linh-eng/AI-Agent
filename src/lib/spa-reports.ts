// =============================================================================
// BÁO CÁO KINH DOANH SPA — tổng hợp từ dữ liệu sẵn có (Invoice/Payment/Deposit/
// Booking/TreatmentSession/Customer). KHÔNG thêm schema/migration.
//   * Doanh thu (tháng/năm) = Payment CHƯA HỦY + Deposit ĐÃ PHÂN BỔ (tiền thực thu).
//   * Công nợ = Σ (total − đã trả) của hóa đơn chưa hủy còn nợ.
//   * Dữ liệu tài chính (doanh thu/công nợ/giá trị) chỉ hiện khi finance.read (mask ở route).
// =============================================================================
import { prisma } from "./prisma";

const num = (v: unknown) => Number(v ?? 0);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt", CARD: "Thẻ", TRANSFER: "Chuyển khoản", EWALLET: "Ví điện tử", OTHER: "Khác",
};
const BOOKING_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới", PENDING: "Chờ xử lý", CONFIRMED: "Đã xác nhận", ARRIVED: "Khách đã đến",
  IN_PROGRESS: "Đang thực hiện", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến", RESCHEDULED: "Đã đổi lịch",
};

export type SpaReport = Awaited<ReturnType<typeof buildSpaReport>>;

/**
 * Tổng hợp báo cáo spa. `now` truyền vào để test tất định.
 */
export async function buildSpaReport(now: Date = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    payMonth, payYear, depMonth, depYear,
    pay12m, dep12m,
    payByMethod,
    bookingsByStatus,
    bookingsToday, newCustomersMonth, totalActiveCustomers,
    sessionsMonth,
    topServicesRaw,
    openInvoices,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { voidedAt: null, paidAt: { gte: monthStart } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { voidedAt: null, paidAt: { gte: yearStart } } }),
    prisma.deposit.aggregate({ _sum: { amount: true }, where: { status: "ALLOCATED", allocatedAt: { gte: monthStart } } }),
    prisma.deposit.aggregate({ _sum: { amount: true }, where: { status: "ALLOCATED", allocatedAt: { gte: yearStart } } }),
    prisma.payment.findMany({ where: { voidedAt: null, paidAt: { gte: twelveMonthsAgo } }, select: { amount: true, paidAt: true } }),
    prisma.deposit.findMany({ where: { status: "ALLOCATED", allocatedAt: { gte: twelveMonthsAgo } }, select: { amount: true, allocatedAt: true } }),
    prisma.payment.groupBy({ by: ["method"], where: { voidedAt: null, paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.booking.groupBy({ by: ["status"], where: { scheduledAt: { gte: monthStart } }, _count: true }),
    prisma.booking.count({ where: { scheduledAt: { gte: todayStart, lt: new Date(todayStart.getTime() + 864e5) } } }),
    prisma.customer.count({ where: { createdAt: { gte: monthStart }, isActive: true } }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.treatmentSession.count({ where: { performedAt: { gte: monthStart } } }),
    prisma.treatmentSession.groupBy({ by: ["serviceId"], where: { performedAt: { gte: yearStart }, serviceId: { not: null } }, _count: true }),
    prisma.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIAL"] } }, select: { id: true, total: true, customerId: true, customer: { select: { code: true, fullName: true } } } }),
  ]);

  // --- Doanh thu 12 tháng (tiền thực thu = payment + deposit allocated) ---
  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) buckets.set(monthKey(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)), 0);
  for (const p of pay12m) { const k = monthKey(p.paidAt); if (buckets.has(k)) buckets.set(k, buckets.get(k)! + num(p.amount)); }
  for (const d of dep12m) { if (!d.allocatedAt) continue; const k = monthKey(d.allocatedAt); if (buckets.has(k)) buckets.set(k, buckets.get(k)! + num(d.amount)); }
  const revenueSeries = Array.from(buckets.entries()).map(([month, value]) => ({ month, value }));

  // --- Công nợ theo khách (Σ total − đã trả của hóa đơn còn nợ) ---
  const invIds = openInvoices.map((i) => i.id);
  const [payGroup, depGroup] = invIds.length
    ? await Promise.all([
        prisma.payment.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invIds }, voidedAt: null }, _sum: { amount: true } }),
        prisma.deposit.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invIds }, status: "ALLOCATED" }, _sum: { amount: true } }),
      ])
    : [[], []];
  const paidByInv = new Map<string, number>();
  for (const g of payGroup) if (g.invoiceId) paidByInv.set(g.invoiceId, (paidByInv.get(g.invoiceId) ?? 0) + num(g._sum.amount));
  for (const g of depGroup) if (g.invoiceId) paidByInv.set(g.invoiceId, (paidByInv.get(g.invoiceId) ?? 0) + num(g._sum.amount));
  const debtByCustomer = new Map<string, { code: string; name: string; outstanding: number; invoices: number }>();
  let totalOutstanding = 0;
  for (const inv of openInvoices) {
    const out = Math.max(0, num(inv.total) - (paidByInv.get(inv.id) ?? 0));
    if (out <= 0) continue;
    totalOutstanding += out;
    const key = inv.customerId;
    const cur = debtByCustomer.get(key) ?? { code: inv.customer?.code ?? "", name: inv.customer?.fullName ?? "—", outstanding: 0, invoices: 0 };
    cur.outstanding += out; cur.invoices += 1;
    debtByCustomer.set(key, cur);
  }
  const debtRows = Array.from(debtByCustomer.values()).sort((a, b) => b.outstanding - a.outstanding);

  // --- Top dịch vụ theo lượt thực hiện (năm nay) ---
  const svcIds = topServicesRaw.map((s) => s.serviceId!).filter(Boolean);
  const svcNames = svcIds.length
    ? new Map((await prisma.service.findMany({ where: { id: { in: svcIds } }, select: { id: true, code: true, name: true } })).map((s) => [s.id, s]))
    : new Map();
  const topServices = topServicesRaw
    .map((s) => ({ code: svcNames.get(s.serviceId!)?.code ?? "", name: svcNames.get(s.serviceId!)?.name ?? "—", count: s._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const revenueMonth = num(payMonth._sum.amount) + num(depMonth._sum.amount);
  const revenueYear = num(payYear._sum.amount) + num(depYear._sum.amount);

  return {
    generatedAt: now.toISOString(),
    kpi: {
      revenueMonth, revenueYear, totalOutstanding,
      bookingsToday, newCustomersMonth, totalActiveCustomers, sessionsMonth,
      openInvoices: openInvoices.length,
    },
    revenueSeries,
    paymentsByMethod: payByMethod.map((m) => ({ method: m.method, label: PAYMENT_METHOD_LABEL[m.method] ?? m.method, amount: num(m._sum.amount), count: m._count })),
    bookingsByStatus: bookingsByStatus.map((b) => ({ status: b.status, label: BOOKING_STATUS_LABEL[b.status] ?? b.status, count: b._count })),
    debtByCustomer: debtRows,
    topServices,
  };
}

/** Che dữ liệu tài chính khi thiếu finance.read (giữ số đếm vận hành). */
export function maskSpaReport(r: SpaReport, canFinance: boolean) {
  if (canFinance) return r;
  return {
    ...r,
    kpi: { ...r.kpi, revenueMonth: null, revenueYear: null, totalOutstanding: null },
    revenueSeries: null,
    paymentsByMethod: null,
    debtByCustomer: null,
  };
}
