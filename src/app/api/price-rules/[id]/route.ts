export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { auditLog } from "@/lib/clinic";

// Chỉ ARCHIVE (ngừng hiệu lực) — không sửa/xóa để giữ lịch sử giá (mục 9).
export const DELETE = handle(async (_req, { params }) => {
  const session = await requirePermission(PERMISSIONS.PRICE_WRITE);
  const rule = await prisma.priceRule.update({ where: { id: params.id }, data: { isActive: false } });
  await auditLog({ userId: session.userId, action: "PRICE_ARCHIVE", entityType: "PriceRule", entityId: rule.id });
  return ok({ id: rule.id, isActive: rule.isActive });
});
