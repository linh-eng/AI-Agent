export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { sessionReorderSchema } from "@/lib/clinic-validation";

// Kéo–thả sắp xếp thứ tự buổi trong phác đồ (mục 8 phần bổ sung)
export const PATCH = handle(async (req) => {
  await requirePermission(PERMISSIONS.TREATMENT_WRITE);
  const { order } = sessionReorderSchema.parse(await req.json());
  await prisma.$transaction(
    order.map((o) =>
      prisma.treatmentSession.update({ where: { id: o.id }, data: { orderIndex: o.orderIndex } })
    )
  );
  return ok({ updated: order.length });
});
