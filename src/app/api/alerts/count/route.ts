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

// Tổng số cảnh báo hiện có — dùng cho badge ở menu (thông báo tự động).
export const GET = handle(async () => {
  await requirePermission(PERMISSIONS.INVENTORY_READ);
  const [expiry, lowStock, warranty, shots, unopened, maintenance, debts] = await Promise.all([
    getExpiryAlerts(null),
    getLowStockAlerts(null),
    getWarrantyAlerts(),
    getShotAlerts(),
    getUnopenedStaleAlerts(),
    getMaintenanceDueAlerts(),
    getDebtDueAlerts(),
  ]);
  const total =
    expiry.length + lowStock.length + warranty.length + shots.length + unopened.length + maintenance.length + debts.length;
  return ok({ total, maintenance: maintenance.length, warranty: warranty.length });
});
