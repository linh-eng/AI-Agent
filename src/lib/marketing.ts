// =============================================================================
// Module 10 — Marketing metrics / ROI (attribution first-touch qua campaignId).
// =============================================================================
import { prisma } from "./prisma";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface CampaignMetrics {
  leads: number;
  customers: number;
  bookings: number;
  completedBookings: number;
  revenue: number;
  cost: number;
  conversionRate: number; // customers / leads
  costPerLead: number | null;
  costPerCustomer: number | null;
  roi: number | null; // (revenue - cost) / cost
}

export async function campaignMetrics(campaignId: string, cost: number): Promise<CampaignMetrics> {
  const [leads, customers, bookings, completedBookings, payAgg] = await Promise.all([
    prisma.lead.count({ where: { campaignId } }),
    prisma.customer.count({ where: { campaignId, isActive: true } }),
    prisma.booking.count({ where: { OR: [{ campaignId }, { customer: { campaignId } }] } }),
    prisma.booking.count({ where: { status: "COMPLETED", OR: [{ campaignId }, { customer: { campaignId } }] } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { customer: { campaignId } } }),
  ]);
  const revenue = num(payAgg._sum.amount);
  return {
    leads,
    customers,
    bookings,
    completedBookings,
    revenue,
    cost,
    conversionRate: leads ? customers / leads : 0,
    costPerLead: leads ? cost / leads : null,
    costPerCustomer: customers ? cost / customers : null,
    roi: cost ? (revenue - cost) / cost : null,
  };
}
