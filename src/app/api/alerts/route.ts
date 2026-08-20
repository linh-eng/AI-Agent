export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getExpiryAlerts,
  getLowStockAlerts,
  getWarrantyAlerts,
  getShotAlerts,
  getUnopenedStaleAlerts,
  getMaintenanceDueAlerts,
  getDebtDueAlerts,
} from "@/lib/inventory";

export const GET = handle(async (req) => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId");
  const [expiry, lowStock, warranty, shots, unopened, maintenance, debts] = await Promise.all([
    getExpiryAlerts(warehouseId),
    getLowStockAlerts(warehouseId),
    getWarrantyAlerts(),
    getShotAlerts(),
    getUnopenedStaleAlerts(),
    getMaintenanceDueAlerts(),
    getDebtDueAlerts(),
  ]);
  return ok({ expiry, lowStock, warranty, shots, unopened, maintenance, debts });
});
