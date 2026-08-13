export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission, getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { treatmentPlanUpdateSchema } from "@/lib/clinic-validation";
import { canSeeFinance, maskFinance, auditLog } from "@/lib/clinic";

export const GET = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.TREATMENT_READ);
  const session = await getSession();
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { code: true, fullName: true, phone: true } },
      stages: { orderBy: { orderIndex: "asc" } },
      sessions: {
        include: {
          service: { select: { name: true } },
          stage: { select: { name: true } },
          technology: { select: { name: true } },
          brandProtocol: { select: { name: true, code: true } },
          booking: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              durationMinutes: true,
              technician: true,
              master: true,
              room: true,
              bed: true,
              machine: true,
            },
          },
          staff: { select: { id: true, staffName: true, role: true } },
        },
        orderBy: [{ orderIndex: "asc" }, { sessionNumber: "asc" }],
      },
      versions: { orderBy: { toVersion: "desc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!plan) return fail(404, "Không tìm thấy phác đồ");

  const canSee = canSeeFinance(session);
  const sessions = plan.sessions.map((s) =>
    maskFinance(s, canSee, ["plannedCost", "actualCost"])
  );
  return ok({ ...plan, sessions, canSeeFinance: canSee });
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = treatmentPlanUpdateSchema.parse(await req.json());
  const { bumpVersion, changeReason, changedBy, ...rest } = parsed;

  const current = await prisma.treatmentPlan.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy phác đồ");

  const data: Record<string, unknown> = { ...rest };

  // Đánh dấu thời điểm duyệt khi chuyển sang APPROVED (nếu chưa có)
  if (rest.status === "APPROVED" && !current.approvedAt) {
    data.approvedAt = new Date();
    if (!current.approver && !rest.approver) data.approver = session.name;
  }

  // Tạo version mới qua đường PATCH (giữ tương thích): tăng version + ghi changeLog + bảng versions
  if (bumpVersion) {
    const log = Array.isArray(current.changeLog) ? (current.changeLog as any[]) : [];
    log.push({
      fromVersion: current.version,
      toVersion: current.version + 1,
      reason: changeReason ?? null,
      changedBy: changedBy ?? session.name,
      at: new Date().toISOString(),
    });
    data.version = current.version + 1;
    data.changeLog = log as any;
    data.versions = {
      create: {
        fromVersion: current.version,
        toVersion: current.version + 1,
        reason: changeReason ?? "(không ghi lý do)",
        createdBy: changedBy ?? session.name,
      },
    } as any;
  }

  const plan = await prisma.treatmentPlan.update({ where: { id: params.id }, data });
  await auditLog({
    userId: session.userId,
    action: bumpVersion ? "VERSION_BUMP" : "UPDATE",
    entityType: "TreatmentPlan",
    entityId: plan.id,
    changes: { version: plan.version, ...rest },
  });
  return ok(plan);
});
