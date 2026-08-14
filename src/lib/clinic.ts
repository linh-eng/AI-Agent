// =============================================================================
// Tiện ích nghiệp vụ Module Spa / Thẩm mỹ.
//   * Sinh mã tuần tự (KH / BK / TP)
//   * Tổng hợp tài chính khách hàng (đã trả / phải trả / công nợ)
//   * Dựng timeline tổng hợp hồ sơ khách hàng (mục 23)
// =============================================================================
import { prisma } from "./prisma";
import { PERMISSIONS } from "./rbac";
import type { SessionPayload } from "./auth";
import { customerInvoiceFinancials } from "./invoice";

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
  // Công nợ tính TỪ HÓA ĐƠN (mục 18): khi khách đã có hóa đơn, dùng nguồn sự thật
  // hóa đơn (đã trừ phiếu thu đã hủy + cộng cọc đã phân bổ, không đếm trùng).
  const invoiceFin = await customerInvoiceFinancials(customerId);
  if (invoiceFin.invoiceCount > 0) {
    return { totalPaid: invoiceFin.totalPaid, totalBilled: invoiceFin.totalBilled, debt: invoiceFin.debt };
  }

  // Fallback (khách chưa có hóa đơn nào) — giữ tương thích dữ liệu cũ theo phác đồ/booking.
  const [plans, bookings, payments] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: { customerId, status: { not: "CANCELLED" } },
      select: { totalPrice: true, discount: true },
    }),
    prisma.booking.findMany({
      where: { customerId, status: { in: ["COMPLETED", "IN_PROGRESS", "ARRIVED", "CONFIRMED"] } },
      select: { price: true, discount: true },
    }),
    prisma.payment.findMany({ where: { customerId, voidedAt: null }, select: { amount: true } }),
  ]);

  const planBilled = plans.reduce((s, p) => s + num(p.totalPrice) - num(p.discount), 0);
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

// Nhãn vai trò nhân sự buổi (dùng cho timeline khách).
const SESSION_STAFF_ROLE_VN: Record<string, string> = {
  PRIMARY: "Chính", ASSISTANT: "Hỗ trợ", MASTER: "Master", CHECKER: "Kiểm tra", CONSULTANT: "Tư vấn",
};

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
    | "invoice"
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
  const [activities, bookings, assessments, plans, sessions, payments, invoices, proposals, cares, recs] =
    await Promise.all([
      prisma.crmActivity.findMany({ where: { customerId }, orderBy: { occurredAt: "desc" } }),
      prisma.booking.findMany({
        where: { customerId },
        include: { service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      }),
      prisma.assessment.findMany({ where: { customerId }, orderBy: { assessedAt: "desc" } }),
      prisma.treatmentPlan.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } }),
      prisma.treatmentSession.findMany({
        where: { customerId },
        include: { staff: { orderBy: { createdAt: "asc" } }, review: true, service: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({ where: { customerId }, orderBy: { paidAt: "desc" } }),
      prisma.invoice.findMany({ where: { customerId }, orderBy: { issuedAt: "desc" } }),
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
    // Ghi nhân sự thực hiện (chính/master...) vào timeline khách (mục 24).
    const staffLine = (s.staff ?? [])
      .map((st) => `${st.staffName} (${SESSION_STAFF_ROLE_VN[st.role] ?? st.role})`)
      .join(", ");
    const rv = s.review;
    const reviewLine = rv && (rv.satisfactionScore || rv.technicianScore)
      ? `Đánh giá: hài lòng ${rv.satisfactionScore ?? "—"}/5${rv.technicianScore ? `, KTV ${rv.technicianScore}/5` : ""}`
      : undefined;
    const detail = [s.customerFeedback ?? s.objective ?? undefined, staffLine ? `Nhân sự: ${staffLine}` : undefined, reviewLine]
      .filter(Boolean)
      .join(" · ");
    // Buổi đã thực hiện → "Đã thực hiện [dịch vụ]"; chưa thực hiện → "Buổi N" (mục 31).
    const svcName = (s as any).service?.name as string | undefined;
    const done = s.status === "COMPLETED" || !!s.performedAt;
    const title = done
      ? `Đã thực hiện${svcName ? " · " + svcName : ""} (Buổi ${s.sessionNumber})`
      : `Buổi ${s.sessionNumber}${s.name ? " · " + s.name : ""}`;
    events.push({
      id: `se-${s.id}`,
      at: when.toISOString(),
      kind: "session",
      title,
      detail: detail || undefined,
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
  for (const inv of invoices) {
    events.push({
      id: `inv-${inv.id}`,
      at: inv.issuedAt.toISOString(),
      kind: "invoice",
      title: `Hóa đơn ${inv.code} · ${new Intl.NumberFormat("vi-VN").format(num(inv.total))} ₫`,
      status: inv.status,
      href: `/invoices/${inv.id}`,
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

// Trạng thái booking còn "giữ chỗ" (chưa hủy/không đến/hoàn thành).
const BOOKING_ACTIVE = ["NEW", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "RESCHEDULED"] as const;

export interface CustomerSummary {
  totalSessions: number; // buổi đã hoàn thành
  totalBookings: number;
  nextBooking: { id: string; code: string; scheduledAt: string; serviceName: string | null; technician: string | null; status: string } | null;
  nextFollowUp: { id: string; title: string; dueDate: string | null; assignee: string | null } | null;
  pendingCareTasks: number; // số việc CSKH đang chờ
  activePlan: { id: string; code: string; name: string; version: number; status: string; totalSessions: number; doneSessions: number; nextSessionAt: string | null; currentStage: string | null } | null;
  lastSession: { id: string; at: string | null; serviceName: string | null; technician: string | null; planName: string | null } | null;
  lastService: string | null;
  lastTechnician: string | null;
  lastReview: { at: string; satisfactionScore: number | null; technicianScore: number | null } | null;
}

/**
 * Tổng hợp nhanh cho HEADER hồ sơ khách hàng 360° — trả lời "khách đang ở đâu,
 * làm gì tiếp theo, gần nhất làm gì". Mọi số liệu suy từ dữ liệu hiện có, không
 * lưu cứng. Nếu thiếu dữ liệu → trả null để UI hiển thị trạng thái rõ ràng.
 */
export async function customerSummary(customerId: string): Promise<CustomerSummary> {
  const now = new Date();
  const [completedCount, totalBookings, nextBookingRow, nextTask, pendingCareTasks, plan, lastSess, lastReview] =
    await Promise.all([
      prisma.treatmentSession.count({ where: { customerId, status: "COMPLETED" } }),
      prisma.booking.count({ where: { customerId } }),
      prisma.booking.findFirst({
        where: { customerId, scheduledAt: { gte: now }, status: { in: [...BOOKING_ACTIVE] as any } },
        include: { service: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.task.findFirst({
        where: { customerId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { not: null } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.task.count({ where: { customerId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.treatmentPlan.findFirst({
        where: { customerId, status: { in: ["ACTIVE", "PAUSED"] } },
        include: {
          _count: { select: { sessions: true } },
          stages: { select: { id: true, name: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
          sessions: { select: { id: true, status: true, scheduledAt: true, sessionNumber: true, stageId: true }, orderBy: { sessionNumber: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.treatmentSession.findFirst({
        where: { customerId, status: "COMPLETED" },
        include: { service: { select: { name: true } }, plan: { select: { name: true } }, staff: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ performedAt: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.sessionReview.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } }),
    ]);

  const nextBooking = nextBookingRow
    ? {
        id: nextBookingRow.id,
        code: nextBookingRow.code,
        scheduledAt: nextBookingRow.scheduledAt.toISOString(),
        serviceName: nextBookingRow.service?.name ?? null,
        technician: nextBookingRow.technician ?? null,
        status: nextBookingRow.status,
      }
    : null;

  const nextFollowUp = nextTask
    ? { id: nextTask.id, title: nextTask.title, dueDate: nextTask.dueDate ? nextTask.dueDate.toISOString() : null, assignee: nextTask.assignee ?? null }
    : null;

  let activePlan: CustomerSummary["activePlan"] = null;
  if (plan) {
    const doneSessions = plan.sessions.filter((s) => s.status === "COMPLETED").length;
    const upcoming = plan.sessions.find((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED" && s.scheduledAt);
    // Giai đoạn hiện tại = giai đoạn của buổi kế chưa xong; nếu đã xong hết thì lấy
    // giai đoạn của buổi cuối; fallback giai đoạn đầu tiên của phác đồ. KHÔNG dùng
    // số buổi làm tên giai đoạn.
    const stageIdOfCurrent =
      plan.sessions.find((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED")?.stageId ??
      [...plan.sessions].reverse().find((s) => s.status === "COMPLETED")?.stageId ??
      plan.stages[0]?.id ??
      null;
    const currentStage =
      (stageIdOfCurrent ? plan.stages.find((st) => st.id === stageIdOfCurrent)?.name : null) ??
      plan.stages[0]?.name ??
      null;
    activePlan = {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      version: plan.version,
      status: plan.status,
      totalSessions: plan._count.sessions,
      doneSessions,
      nextSessionAt: upcoming?.scheduledAt ? upcoming.scheduledAt.toISOString() : null,
      currentStage,
    };
  }

  const primaryStaff = lastSess?.staff?.find((st) => st.role === "PRIMARY") ?? lastSess?.staff?.[0];
  const lastTechnician = lastSess?.performer ?? primaryStaff?.staffName ?? null;
  const lastSession = lastSess
    ? {
        id: lastSess.id,
        at: (lastSess.performedAt ?? lastSess.updatedAt)?.toISOString() ?? null,
        serviceName: lastSess.service?.name ?? null,
        technician: lastTechnician,
        planName: lastSess.plan?.name ?? null,
      }
    : null;

  return {
    totalSessions: completedCount,
    totalBookings,
    nextBooking,
    nextFollowUp,
    pendingCareTasks,
    activePlan,
    lastSession,
    lastService: lastSess?.service?.name ?? null,
    lastTechnician,
    lastReview: lastReview
      ? { at: lastReview.createdAt.toISOString(), satisfactionScore: lastReview.satisfactionScore, technicianScore: lastReview.technicianScore }
      : null,
  };
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
