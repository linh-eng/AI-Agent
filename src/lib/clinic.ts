// =============================================================================
// Tiện ích nghiệp vụ Module Spa / Thẩm mỹ.
//   * Sinh mã tuần tự (KH / BK / TP)
//   * Tổng hợp tài chính khách hàng (đã trả / phải trả / công nợ)
//   * Dựng timeline tổng hợp hồ sơ khách hàng (mục 23)
// =============================================================================
import { prisma } from "./prisma";
import { PERMISSIONS } from "./rbac";
import type { SessionPayload } from "./auth";

/** Sinh mã tuần tự dạng PREFIX-000123 dựa trên số bản ghi hiện có. */
export function sequentialCode(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}

/** Có được xem dữ liệu tài chính nhạy cảm (giá vốn/chi phí/lợi nhuận) không. */
export function canSeeFinance(session: SessionPayload | null): boolean {
  return !!session?.permissions.includes(PERMISSIONS.FINANCE_READ);
}

/** Loại bỏ các trường tài chính nhạy cảm khỏi object nếu không có quyền. */
export function maskFinance<T extends Record<string, any>>(
  obj: T,
  canSee: boolean,
  fields: string[]
): T {
  if (canSee) return obj;
  const clone: Record<string, any> = { ...obj };
  for (const f of fields) if (f in clone) clone[f] = null;
  return clone as T;
}

export interface CustomerFinancials {
  totalPaid: number;
  totalBilled: number;
  debt: number;
}

/**
 * Tổng hợp tài chính của một khách hàng:
 *  - totalBilled: tổng giá phác đồ (ưu tiên) + giá booking không thuộc phác đồ nào.
 *  - totalPaid: tổng các khoản đã thanh toán.
 *  - debt: chênh lệch (>= 0).
 */
export async function customerFinancials(customerId: string): Promise<CustomerFinancials> {
  const [plans, bookings, payments] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: { customerId, status: { not: "CANCELLED" } },
      select: { totalPrice: true, discount: true },
    }),
    prisma.booking.findMany({
      where: { customerId, status: { in: ["COMPLETED", "IN_PROGRESS", "ARRIVED", "CONFIRMED"] } },
      select: { price: true, discount: true },
    }),
    prisma.payment.findMany({ where: { customerId }, select: { amount: true } }),
  ]);

  const planBilled = plans.reduce(
    (s, p) => s + num(p.totalPrice) - num(p.discount),
    0
  );
  // Nếu có phác đồ, coi phác đồ là nguồn doanh thu chính; booking lẻ cộng thêm.
  const bookingBilled = bookings.reduce((s, b) => s + num(b.price) - num(b.discount), 0);
  const totalBilled = planBilled + (plans.length === 0 ? bookingBilled : 0);
  const totalPaid = payments.reduce((s, p) => s + num(p.amount), 0);
  return {
    totalPaid,
    totalBilled,
    debt: Math.max(0, totalBilled - totalPaid),
  };
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface TimelineEvent {
  id: string;
  at: string; // ISO
  kind:
    | "crm"
    | "booking"
    | "assessment"
    | "plan"
    | "session"
    | "payment"
    | "proposal"
    | "care"
    | "recommendation";
  title: string;
  detail?: string;
  status?: string;
  href?: string;
}

/**
 * Dựng timeline tổng hợp cho một khách hàng (mục 23) — gộp mọi loại sự kiện,
 * sắp xếp giảm dần theo thời gian.
 */
export async function buildCustomerTimeline(customerId: string): Promise<TimelineEvent[]> {
  const [activities, bookings, assessments, plans, sessions, payments, proposals, cares, recs] =
    await Promise.all([
      prisma.crmActivity.findMany({ where: { customerId }, orderBy: { occurredAt: "desc" } }),
      prisma.booking.findMany({
        where: { customerId },
        include: { service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      }),
      prisma.assessment.findMany({ where: { customerId }, orderBy: { assessedAt: "desc" } }),
      prisma.treatmentPlan.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } }),
      prisma.treatmentSession.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } }),
      prisma.payment.findMany({ where: { customerId }, orderBy: { paidAt: "desc" } }),
      prisma.treatmentProposal.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } }),
      prisma.careInstructionInstance.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } }),
      prisma.productRecommendation.findMany({
        where: { customerId },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const events: TimelineEvent[] = [];

  for (const a of activities) {
    events.push({
      id: `crm-${a.id}`,
      at: a.occurredAt.toISOString(),
      kind: "crm",
      title: `CSKH: ${a.type}`,
      detail: a.content,
      status: a.result ?? undefined,
    });
  }
  for (const b of bookings) {
    events.push({
      id: `bk-${b.id}`,
      at: b.scheduledAt.toISOString(),
      kind: "booking",
      title: `Booking ${b.code}${b.service ? " · " + b.service.name : ""}`,
      detail: b.note ?? undefined,
      status: b.status,
    });
  }
  for (const a of assessments) {
    events.push({
      id: `as-${a.id}`,
      at: a.assessedAt.toISOString(),
      kind: "assessment",
      title: `Đánh giá: ${a.name}`,
      detail: a.description ?? undefined,
      status: a.severity ?? undefined,
    });
  }
  for (const p of plans) {
    events.push({
      id: `pl-${p.id}`,
      at: p.createdAt.toISOString(),
      kind: "plan",
      title: `Phác đồ ${p.name} (v${p.version})`,
      detail: p.goals ?? undefined,
      status: p.status,
    });
  }
  for (const s of sessions) {
    const when = s.performedAt ?? s.scheduledAt ?? s.createdAt;
    events.push({
      id: `se-${s.id}`,
      at: when.toISOString(),
      kind: "session",
      title: `Buổi ${s.sessionNumber}${s.name ? " · " + s.name : ""}`,
      detail: s.customerFeedback ?? s.objective ?? undefined,
      status: s.status,
    });
  }
  for (const p of payments) {
    events.push({
      id: `pm-${p.id}`,
      at: p.paidAt.toISOString(),
      kind: "payment",
      title: `Thanh toán ${new Intl.NumberFormat("vi-VN").format(num(p.amount))} ₫`,
      detail: p.note ?? undefined,
      status: p.method,
    });
  }
  for (const pr of proposals) {
    events.push({
      id: `pr-${pr.id}`,
      at: (pr.acceptedAt ?? pr.createdAt).toISOString(),
      kind: "proposal",
      title: `Báo giá ${pr.title}`,
      detail: pr.acceptedAt
        ? `Đã chốt · ${new Intl.NumberFormat("vi-VN").format(num(pr.agreedPrice))} ₫`
        : undefined,
      status: pr.status,
      href: `/proposals/${pr.id}`,
    });
  }
  for (const ci of cares) {
    events.push({
      id: `ci-${ci.id}`,
      at: (ci.deliveredAt ?? ci.createdAt).toISOString(),
      kind: "care",
      title: `Hướng dẫn: ${ci.title}`,
      detail: ci.deliveredAt ? `Đã gửi qua ${ci.deliveredVia}` : "Chưa gửi",
      status: ci.kind,
    });
  }
  for (const r of recs) {
    events.push({
      id: `rc-${r.id}`,
      at: r.createdAt.toISOString(),
      kind: "recommendation",
      title: `Đề xuất SP: ${r.product?.name ?? ""}`,
      detail: r.reason ?? undefined,
      status: r.priority,
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events;
}

/** Tổng giá 1 phương án báo giá = Σ(đơn giá × SL) − chiết khấu. */
export function proposalOptionTotal(
  items: { unitPrice?: unknown; quantity?: number | null }[],
  discount?: unknown
): number {
  const sub = items.reduce((s, it) => s + num(it.unitPrice) * (it.quantity ?? 1), 0);
  return Math.max(0, sub - num(discount));
}

/** Ghi audit log (append-only) cho hành động nghiệp vụ nhạy cảm (mục 25). */
export async function auditLog(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      changes: (params.changes as any) ?? undefined,
    },
  });
}
