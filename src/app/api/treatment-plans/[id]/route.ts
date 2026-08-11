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
        include: { service: { select: { name: true } }, stage: { select: { name: true } } },
        orderBy: { sessionNumber: "asc" },
      },
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

  // Tạo version mới: tăng version + ghi changeLog (mục 15 — giữ lịch sử thay đổi)
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
