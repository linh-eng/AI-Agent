export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { submitStockCount } from "@/lib/stockcount-service";

export const POST = handle(async (_req, { params }: { params: { id: string } }) => {
  await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const count = await submitStockCount(params.id);
  return ok(count);
});
