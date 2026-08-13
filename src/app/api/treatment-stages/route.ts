export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { created, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stageCreateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

// POST /api/treatment-stages — Thêm 1 giai đoạn vào phác đồ có sẵn (mục 5)
export const POST = handle(async (req) => {
  const session = await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const parsed = stageCreateSchema.parse(await req.json());
  const { planId, id: _ignore, ...rest } = parsed;

  const count = await prisma.treatmentStage.count({ where: { planId } });
  const stage = await prisma.treatmentStage.create({
    data: {
      planId,
      name: rest.name,
      orderIndex: rest.orderIndex ?? count,
      description: rest.description ?? null,
      status: rest.status ?? undefined,
      plannedStartDate: rest.plannedStartDate ?? null,
      plannedEndDate: rest.plannedEndDate ?? null,
      plannedSessions: rest.plannedSessions ?? null,
      frequencyValue: rest.frequencyValue ?? null,
      frequencyUnit: rest.frequencyUnit ?? null,
      note: rest.note ?? null,
    },
  });
  await auditLog({
    userId: session.userId,
    action: "CREATE",
    entityType: "TreatmentStage",
    entityId: stage.id,
    changes: { planId, name: stage.name },
  });
  return created(stage);
});
