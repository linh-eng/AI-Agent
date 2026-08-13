export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, created, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionReviewUpsertSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;
  if (!sessionId && !customerId) return fail(400, "Thiếu sessionId hoặc customerId");
  const reviews = await prisma.sessionReview.findMany({
    where: { ...(sessionId ? { sessionId } : {}), ...(customerId ? { customerId } : {}) },
    include: { session: { select: { sessionNumber: true, name: true, performedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(sessionId ? (reviews[0] ?? null) : reviews);
});

// Upsert đánh giá theo buổi (1 đánh giá / buổi).
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = sessionReviewUpsertSchema.parse(await req.json());
  const ts = await prisma.treatmentSession.findUnique({ where: { id: parsed.sessionId }, select: { id: true, customerId: true } });
  if (!ts) return fail(404, "Không tìm thấy buổi thực hiện");

  const data = {
    satisfactionScore: parsed.satisfactionScore ?? null,
    technicianScore: parsed.technicianScore ?? null,
    technicianName: parsed.technicianName ?? null,
    comment: parsed.comment ?? null,
    wouldReturn: parsed.wouldReturn ?? null,
    technicianReport: parsed.technicianReport ?? null,
    reviewedBy: session.name,
  };
  const review = await prisma.sessionReview.upsert({
    where: { sessionId: parsed.sessionId },
    create: { sessionId: parsed.sessionId, customerId: ts.customerId, ...data },
    update: data,
  });
  await auditLog({
    userId: session.userId,
    action: "SESSION_REVIEW_SET",
    entityType: "SessionReview",
    entityId: review.id,
    changes: { sessionId: parsed.sessionId, satisfactionScore: data.satisfactionScore, technicianScore: data.technicianScore },
  });
  return created(review);
});
