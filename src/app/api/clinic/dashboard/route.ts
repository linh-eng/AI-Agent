export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { canSeeFinance } from "@/lib/clinic";

export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.BOOKING_READ);
  const session = await getSession();
  const canFinance = canSeeFinance(session);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    bookingsToday,
    bookingsUpcoming,
    bookingsCompleted,
    bookingsCancelled,
    newCustomers,
    activePlans,
    overdueTasks,
    payments6m,
    monthCostAgg,
    monthPayAgg,
  ] = await Promise.all([
    prisma.booking.count({ where: { scheduledAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.booking.count({
      where: { scheduledAt: { gte: now }, status: { in: ["NEW", "PENDING", "CONFIRMED"] } },
    }),
    prisma.booking.count({
      where: { status: "COMPLETED", updatedAt: { gte: monthStart } },
    }),
    prisma.booking.count({
      where: { status: { in: ["CANCELLED", "NO_SHOW"] }, updatedAt: { gte: monthStart } },
    }),
    prisma.customer.count({ where: { createdAt: { gte: monthStart }, isActive: true } }),
    prisma.treatmentPlan.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, paidAt: true },
    }),
    prisma.treatmentSession.aggregate({
      _sum: { actualCost: true },
      where: { performedAt: { gte: monthStart } },
    }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
  ]);

  // Chuỗi doanh thu 6 tháng gần nhất (bucket theo tháng)
  const buckets = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const p of payments6m) {
    const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(p.amount));
  }
  const revenueSeries = Array.from(buckets.entries()).map(([month, value]) => ({ month, value }));

  const revenue = Number(monthPayAgg._sum.amount ?? 0);
  const cost = Number(monthCostAgg._sum.actualCost ?? 0);

  return ok({
    bookingsToday,
    bookingsUpcoming,
    bookingsCompleted,
    bookingsCancelled,
    newCustomers,
    activePlans,
    overdueTasks,
    revenue,
    cost: canFinance ? cost : null,
    profit: canFinance ? revenue - cost : null,
    revenueSeries,
    canSeeFinance: canFinance,
  });
});
