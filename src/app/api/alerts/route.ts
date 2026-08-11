export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getExpiryAlerts,
  getLowStockAlerts,
  getWarrantyAlerts,
  getShotAlerts,
} from "@/lib/inventory";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId");
  const [expiry, lowStock, warranty, shots] = await Promise.all([
    getExpiryAlerts(warehouseId),
    getLowStockAlerts(warehouseId),
    getWarrantyAlerts(),
    getShotAlerts(),
  ]);
  return ok({ expiry, lowStock, warranty, shots });
});
