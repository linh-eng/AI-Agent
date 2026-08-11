export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle, fail } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { recomputeSessionMaterialCost } from "@/lib/material-service";

// Xóa dòng vật tư (chỉ khi chưa phát sinh tiêu hao) — giữ toàn vẹn lịch sử chi phí.
export const DELETE = handle(async (_req, { params }) => {
  await requirePermission(PERMISSIONS.MATERIAL_WRITE);
  const sm = await prisma.sessionMaterial.findUnique({
    where: { id: params.id },
    select: { sessionId: true, consumedQty: true },
  });
  if (!sm) return fail(404, "Không tìm thấy dòng vật tư");
  if (Number(sm.consumedQty) > 0) return fail(409, "Đã có tiêu hao — không thể xóa (giữ lịch sử chi phí).");
  await prisma.sessionMaterial.delete({ where: { id: params.id } });
  await recomputeSessionMaterialCost(sm.sessionId);
  return ok({ id: params.id, deleted: true });
});
