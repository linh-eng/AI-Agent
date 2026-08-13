export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { planVersionCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// POST /api/treatment-plans/[id]/version — Tạo phiên bản mới (mục 16–19)
// - Lý do BẮT BUỘC (Zod).
// - ĐÓNG BĂNG: mọi buổi đã hoàn thành chưa gắn version → ghim versionAtExecution = version cũ,
//   để V1 giữ đúng lịch sử (session cũ thuộc đúng version thực hiện).
// - Tăng plan.version, ghi TreatmentPlanVersion (lịch sử) + changeLog (tương thích cũ).
// - KHÔNG ghi đè/di chuyển session lịch sử sang version mới một cách sai lệch.
export const POST = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = planVersionCreateSchema.parse(await req.json());

  const current = await prisma.treatmentPlan.findUnique({
    where: { id: params.id },
    include: { sessions: { select: { id: true, status: true, performedAt: true, versionAtExecution: true } } },
  });
  if (!current) return fail(404, "Không tìm thấy phác đồ");

  const fromVersion = current.version;
  const toVersion = current.version + 1;

  const result = await prisma.$transaction(async (tx) => {
    // Đóng băng version cho buổi đã hoàn thành nhưng chưa ghim version
    const doneUnstamped = current.sessions.filter(
      (s) => (s.status === "COMPLETED" || s.performedAt) && s.versionAtExecution == null,
    );
    if (doneUnstamped.length) {
      await tx.treatmentSession.updateMany({
        where: { id: { in: doneUnstamped.map((s) => s.id) } },
        data: { versionAtExecution: fromVersion },
      });
    }

    const log = Array.isArray(current.changeLog) ? (current.changeLog as any[]) : [];
    log.push({
      fromVersion,
      toVersion,
      reason: parsed.reason,
      summary: parsed.summary ?? null,
      changedBy: parsed.createdBy ?? session.name,
      at: new Date().toISOString(),
    });

    const plan = await tx.treatmentPlan.update({
      where: { id: params.id },
      data: { version: toVersion, changeLog: log as any },
    });

    const ver = await tx.treatmentPlanVersion.create({
      data: {
        planId: params.id,
        fromVersion,
        toVersion,
        reason: parsed.reason,
        summary: parsed.summary ?? null,
        note: parsed.note ?? null,
        createdBy: parsed.createdBy ?? session.name,
      },
    });
    return { plan, ver, frozen: doneUnstamped.length };
  });

  await auditLog({
    userId: session.userId,
    action: "VERSION_BUMP",
    entityType: "TreatmentPlan",
    entityId: params.id,
    changes: { fromVersion, toVersion, reason: parsed.reason, frozenSessions: result.frozen },
  });
  return ok({ version: result.plan.version, history: result.ver, frozenSessions: result.frozen });
});
