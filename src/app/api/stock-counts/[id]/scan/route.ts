export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { stockCountScanSchema } from "@/lib/validation";
import { scanStockCount } from "@/lib/stockcount-service";

export const POST = handle(async (req, { params }: { params: { id: string } }) => {
  const session = await requirePermission(PERMISSIONS.WAREHOUSE_WRITE);
  const { serialNumbers } = stockCountScanSchema.parse(await req.json());
  const result = await scanStockCount(params.id, serialNumbers, session.userId);
  return ok(result);
});
