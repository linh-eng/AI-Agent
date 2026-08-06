export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { approveStockCount } from "@/lib/stockcount-service";

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  // Duyệt chênh lệch kiểm kê là quyền của BGĐ
  const session = await requirePermission(PERMISSIONS.STOCKCOUNT_APPROVE);
  const result = await approveStockCount(params.id, session.userId);
  return ok(result);
});
