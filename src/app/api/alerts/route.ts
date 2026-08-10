export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getExpiryAlerts, getLowStockAlerts, getWarrantyAlerts } from "@/lib/inventory";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId");
  const [expiry, lowStock, warranty] = await Promise.all([
    getExpiryAlerts(warehouseId),
    getLowStockAlerts(warehouseId),
    getWarrantyAlerts(),
  ]);
  return ok({ expiry, lowStock, warranty });
});
