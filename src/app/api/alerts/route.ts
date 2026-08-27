export const dynamic = "force-dynamic";

import { ok, handle } from "@/lib/api";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getExpiryAlerts,
  getProductExpiryAlerts,
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
  const [batchExpiry, lowStock, warranty, shots, unopened, maintenance, debts] = await Promise.all([
    getExpiryAlerts(warehouseId),
    getLowStockAlerts(warehouseId),
    getWarrantyAlerts(),
    getShotAlerts(),
    getUnopenedStaleAlerts(),
    getMaintenanceDueAlerts(),
    getDebtDueAlerts(),
  ]);
  // Bổ sung cảnh báo HSD cấp SẢN PHẨM (ngày mua/mở nắp/HSD) cho hàng không theo lô,
  // bỏ qua sản phẩm đã có lô cảnh báo để tránh trùng; gộp & sắp theo còn ít ngày nhất.
  const seen = new Set(batchExpiry.map((a) => a.productId));
  const productExpiry = await getProductExpiryAlerts(warehouseId, seen);
  const expiry = [...batchExpiry, ...productExpiry].sort((a, b) => a.daysLeft - b.daysLeft);
  return ok({ expiry, lowStock, warranty, shots, unopened, maintenance, debts });
});
