// =============================================================================
// Đánh giá sau buổi (mục 36–37) — tổng hợp điểm hài lòng & điểm kỹ thuật viên,
// và gom ảnh Before/After theo buổi để so sánh (mục 8).
// =============================================================================
import { prisma } from "./prisma";

export interface TechnicianReviewRow {
  technicianName: string;
  count: number;
  avgTechnicianScore: number | null;
}

export interface ReviewSummary {
  totalReviews: number;
  avgSatisfaction: number | null;
  avgTechnician: number | null;
  wouldReturnRate: number | null; // % khách sẽ quay lại
  technicians: TechnicianReviewRow[];
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
}

/**
 * Tổng hợp đánh giá: điểm hài lòng chung, điểm KTV, tỷ lệ quay lại, theo từng KTV.
 * Nhận CÙNG bộ lọc với gallery (khách/dịch vụ/khoảng ngày) → KPI và lưới ảnh luôn
 * cùng phạm vi dữ liệu (mục F). Lọc dịch vụ/ngày qua quan hệ session (performedAt).
 */
export async function reviewSummary(filter: {
  customerId?: string;
  serviceId?: string;
  from?: Date;
  to?: Date;
} = {}): Promise<ReviewSummary> {
  const sessionFilter =
    filter.serviceId || filter.from || filter.to
      ? {
          session: {
            ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
            ...(filter.from || filter.to
              ? { performedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
              : {}),
          },
        }
      : {};
  const reviews = await prisma.sessionReview.findMany({
    where: {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...sessionFilter,
    },
    select: { satisfactionScore: true, technicianScore: true, technicianName: true, wouldReturn: true },
  });
  const sat = reviews.map((r) => r.satisfactionScore).filter((n): n is number => n != null);
  const tech = reviews.map((r) => r.technicianScore).filter((n): n is number => n != null);
  const returnable = reviews.filter((r) => r.wouldReturn != null);
  const wouldReturnRate = returnable.length
    ? Math.round((returnable.filter((r) => r.wouldReturn).length / returnable.length) * 100)
    : null;

  const byTech = new Map<string, number[]>();
  for (const r of reviews) {
    if (!r.technicianName) continue;
    const arr = byTech.get(r.technicianName) ?? [];
    if (r.technicianScore != null) arr.push(r.technicianScore);
    byTech.set(r.technicianName, arr);
  }
  const technicians: TechnicianReviewRow[] = [...byTech.entries()]
    .map(([technicianName, scores]) => ({ technicianName, count: scores.length, avgTechnicianScore: avg(scores) }))
    .sort((a, b) => (b.avgTechnicianScore ?? 0) - (a.avgTechnicianScore ?? 0));

  return {
    totalReviews: reviews.length,
    avgSatisfaction: avg(sat),
    avgTechnician: avg(tech),
    wouldReturnRate,
    technicians,
  };
}

export interface BeforeAfterGroup {
  sessionId: string;
  sessionName: string | null;
  sessionNumber: number;
  performedAt: string | null;
  customerId: string;
  customerName: string;
  serviceName: string | null;
  technicianName: string | null;
  before: { id: string; filename: string }[];
  after: { id: string; filename: string }[];
}

/**
 * Gom ảnh Before/After theo buổi (kèm khách/dịch vụ/KTV/ngày) để so sánh.
 * Lọc theo customerId / serviceId / khoảng ngày.
 */
export async function beforeAfterGroups(filter: {
  customerId?: string;
  serviceId?: string;
  from?: Date;
  to?: Date;
}): Promise<BeforeAfterGroup[]> {
  const media = await prisma.mediaAsset.findMany({
    where: {
      isArchived: false,
      kind: { in: ["BEFORE_IMAGE", "AFTER_IMAGE"] },
      sessionId: { not: null },
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
    },
    select: { id: true, filename: true, kind: true, sessionId: true },
  });
  const sessionIds = [...new Set(media.map((m) => m.sessionId!).filter(Boolean))];
  if (sessionIds.length === 0) return [];

  const sessions = await prisma.treatmentSession.findMany({
    where: {
      id: { in: sessionIds },
      ...(filter.serviceId ? { serviceId: filter.serviceId } : {}),
      ...(filter.from || filter.to
        ? { performedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    },
    select: {
      id: true, name: true, sessionNumber: true, performedAt: true, performer: true,
      customer: { select: { id: true, fullName: true } },
      service: { select: { name: true } },
    },
  });
  const sessMap = new Map(sessions.map((s) => [s.id, s]));

  const groups: BeforeAfterGroup[] = [];
  for (const s of sessions) {
    const mine = media.filter((m) => m.sessionId === s.id);
    groups.push({
      sessionId: s.id,
      sessionName: s.name,
      sessionNumber: s.sessionNumber,
      performedAt: s.performedAt ? s.performedAt.toISOString() : null,
      customerId: s.customer.id,
      customerName: s.customer.fullName,
      serviceName: s.service?.name ?? null,
      technicianName: s.performer ?? null,
      before: mine.filter((m) => m.kind === "BEFORE_IMAGE").map((m) => ({ id: m.id, filename: m.filename })),
      after: mine.filter((m) => m.kind === "AFTER_IMAGE").map((m) => ({ id: m.id, filename: m.filename })),
    });
  }
  // Chỉ giữ nhóm có ít nhất 1 ảnh (session bị lọc theo service/ngày sẽ vắng trong sessMap).
  return groups
    .filter((g) => sessMap.has(g.sessionId) && (g.before.length > 0 || g.after.length > 0))
    .sort((a, b) => (a.performedAt && b.performedAt ? (a.performedAt < b.performedAt ? 1 : -1) : 0));
}
