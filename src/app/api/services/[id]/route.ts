export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { serviceUpdateSchema } from "@/lib/clinic-validation";
import { auditLog } from "@/lib/clinic";

export const PATCH = handle(async (req, { params }) => {
  const session = await requirePermission(PERMISSIONS.SERVICE_WRITE);
  const parsed = serviceUpdateSchema.parse(await req.json());
  const before = await prisma.service.findUnique({
    where: { id: params.id },
    select: { standardPrice: true, expectedCost: true },
  });
  const service = await prisma.service.update({ where: { id: params.id }, data: parsed });
  // Ghi audit khi đổi giá (mục 8, 25 — lưu lịch sử thay đổi giá)
  if (parsed.standardPrice !== undefined || parsed.expectedCost !== undefined) {
    await auditLog({
      userId: session.userId,
      action: "PRICE_CHANGE",
      entityType: "Service",
      entityId: service.id,
      changes: {
        before: { standardPrice: before?.standardPrice, expectedCost: before?.expectedCost },
        after: { standardPrice: service.standardPrice, expectedCost: service.expectedCost },
      },
    });
  }
  return ok(service);
});
