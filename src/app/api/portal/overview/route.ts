export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePortal } from "@/lib/portal-session";

// Tổng quan cổng khách — MỌI truy vấn scope theo customerId TỪ PHIÊN (chống IDOR).
// KHÔNG trả: giá vốn, chi phí, margin, ghi chú nội bộ, đánh giá nội bộ, vật tư,
// tồn kho, audit log.
export const GET = handle(async () => {
  const { customerId } = await requirePortal();
  const now = new Date();

  const [customer, bookings, plans, proposals, cares, recs, media] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { code: true, fullName: true, phone: true },
    }),
    prisma.booking.findMany({
      where: { customerId, scheduledAt: { gte: now }, status: { in: ["NEW", "PENDING", "CONFIRMED"] } },
      select: { id: true, code: true, scheduledAt: true, status: true, room: true, service: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.treatmentPlan.findMany({
      where: { customerId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { id: true, name: true, status: true, goals: true, _count: { select: { sessions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.treatmentProposal.findMany({
      where: { customerId, status: { in: ["SENT", "ACCEPTED"] } },
      select: { id: true, code: true, title: true, status: true, agreedPrice: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.careInstructionInstance.findMany({
      where: { customerId },
      select: { id: true, kind: true, title: true, content: true, deliveredAt: true, acknowledgedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productRecommendation.findMany({
      where: { customerId },
      select: { id: true, reason: true, goal: true, usage: true, quantity: true, price: true, priority: true, product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // CHỈ media đã được nhân viên chủ động chia sẻ cho khách.
    prisma.mediaAsset.findMany({
      where: { customerId, sharedWithCustomer: true, isArchived: false, kind: { in: ["BEFORE_IMAGE", "AFTER_IMAGE", "IMAGE"] } },
      select: { id: true, kind: true, filename: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return ok({ customer, bookings, plans, proposals, cares, recommendations: recs, media });
});
