export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stageUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// PATCH /api/treatment-stages/[id] — Cập nhật 1 giai đoạn (mục 5). KHÔNG hard-delete.
export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = stageUpdateSchema.parse(await req.json());

  const current = await prisma.treatmentStage.findUnique({ where: { id: params.id } });
  if (!current) return fail(404, "Không tìm thấy giai đoạn");

  const stage = await prisma.treatmentStage.update({
    where: { id: params.id },
    data: parsed as any,
  });
  await auditLog({
    userId: session.userId,
    action: "UPDATE",
    entityType: "TreatmentStage",
    entityId: stage.id,
    changes: parsed as any,
  });
  return ok(stage);
});
