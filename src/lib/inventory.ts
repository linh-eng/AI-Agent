// =============================================================================
// Tồn kho realtime + cảnh báo (HSD sắp hết / đã hết hạn / dưới định mức).
// Tồn = tổng quantity của các lô (StockBatch). Lô được cập nhật khi nhập/xuất.
// =============================================================================
import { prisma } from "./prisma";

/** Số ngày mặc định trước HSD bắt đầu cảnh báo (nếu sản phẩm không cấu hình riêng). */
export const DEFAULT_EXPIRY_ALERT_DAYS = 60;

/**
 * Số tháng mặc định để cảnh báo "hàng tồn lâu chưa mở nắp" khi NHÓM HÀNG chưa cấu hình
 * riêng (`Category.storeWarnMonths`). Nhờ vậy cảnh báo vẫn chạy dù chưa khai báo ngưỡng
 * cho từng nhóm. Có thể chỉnh theo từng nhóm để chặt/lỏng hơn.
 */
export const DEFAULT_STORE_WARN_MONTHS = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntil(date: Date | string, from = new Date()): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / MS_PER_DAY);
}

/**
 * Cộng thêm n tháng, KẸP về cuối tháng nếu ngày gốc vượt số ngày của tháng đích
 * (vd 31/01 + 1 tháng = 28/02, không nhảy sang 03/03 như Date mặc định).
 */
export function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const r = new Date(d);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

/**
 * HSD hiệu lực cấp SẢN PHẨM = min( HSD trên bao bì, ngày mở nắp + PAO nhóm ).
 * Luôn theo ngày mua/mở nắp người dùng nhập, không dùng ngày tạo bản ghi.
 */
export function productEffectiveExpiry(p: {
  expiryDate: Date | null;
  openedDate: Date | null;
  category: { openMaxMonths: number | null } | null;
}): { date: Date | null; byOpen: boolean } {
  const pkg = p.expiryDate ?? null;
  const pao = p.category?.openMaxMonths ?? null;
  const postOpen = p.openedDate && pao ? addMonths(p.openedDate, pao) : null;
  if (pkg && postOpen) return postOpen < pkg ? { date: postOpen, byOpen: true } : { date: pkg, byOpen: false };
  if (postOpen) return { date: postOpen, byOpen: true };
  return { date: pkg, byOpen: false };
}

export interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  uom: string;
  category: string | null;
  trackingMode: "LOT" | "QUANTITY";
  onHand: number;
  minStock: number | null;
  batchCount: number;
  nearestExpiry: string | null; // ISO
  value: number; // giá trị tồn ước tính theo giá vốn
  belowMin: boolean;
}

/** Tồn theo sản phẩm (gộp mọi lô), lọc theo kho nếu có. */
export async function getInventoryRows(
  warehouseId?: string | null
): Promise<InventoryRow[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      batches: {
        where: warehouseId ? { warehouseId } : undefined,
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => {
    const batches = p.batches.filter((b) => b.quantity > 0);
    const onHand = batches.reduce((s, b) => s + b.quantity, 0);
    const value = batches.reduce(
      (s, b) => s + b.quantity * (b.unitCost ?? 0),
      0
    );
    const expiryDates = batches
      .map((b) => b.expiryDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      uom: p.uom,
      category: p.category?.name ?? null,
      trackingMode: p.trackingMode,
      onHand,
      minStock: p.minStock,
      batchCount: batches.length,
      nearestExpiry: expiryDates[0]?.toISOString() ?? null,
      value,
      belowMin: p.minStock != null && onHand <= p.minStock,
    };
  });
}

export interface ExpiryAlert {
  batchId: string;
  productId: string;
  sku: string;
  productName: string;
  warehouse: string;
  batchCode: string | null;
  expiryDate: string;
  daysLeft: number;
  quantity: number;
  uom: string;
  status: "EXPIRED" | "NEAR";
}

/** Lô đã hết hạn hoặc sắp hết hạn (trong ngưỡng cảnh báo của từng sản phẩm). */
export async function getExpiryAlerts(
  warehouseId?: string | null
): Promise<ExpiryAlert[]> {
  const batches = await prisma.stockBatch.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { not: null },
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: { product: true, warehouse: true },
    orderBy: { expiryDate: "asc" },
  });

  const alerts: ExpiryAlert[] = [];
  for (const b of batches) {
    if (!b.expiryDate) continue;
    const threshold = b.product.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
    const left = daysUntil(b.expiryDate);
    if (left > threshold) continue;
    alerts.push({
      batchId: b.id,
      productId: b.productId,
      sku: b.product.sku,
      productName: b.product.name,
      warehouse: b.warehouse.name,
      batchCode: b.batchCode,
      expiryDate: b.expiryDate.toISOString(),
      daysLeft: left,
      quantity: b.quantity,
      uom: b.product.uom,
      status: left < 0 ? "EXPIRED" : "NEAR",
    });
  }
  return alerts;
}

/**
 * Cảnh báo HSD theo cấp SẢN PHẨM (mốc ngày mua/mở nắp/HSD nhập ở trang Sản phẩm),
 * dùng cho hàng KHÔNG theo dõi HSD theo lô — nếu không sẽ không xuất hiện ở cảnh báo.
 * HSD hiệu lực = min(HSD bao bì, ngày mở nắp + PAO nhóm). "Còn lại" = tồn thực tế.
 * Chỉ tính sản phẩm còn tồn ( > 0 ) và bỏ qua sản phẩm đã có lô cảnh báo (tránh trùng).
 */
export async function getProductExpiryAlerts(
  warehouseId?: string | null,
  skipProductIds: Set<string> = new Set()
): Promise<ExpiryAlert[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ expiryDate: { not: null } }, { openedDate: { not: null } }],
    },
    include: {
      category: { select: { openMaxMonths: true } },
      batches: { where: warehouseId ? { warehouseId } : undefined, select: { quantity: true } },
    },
  });

  const alerts: ExpiryAlert[] = [];
  for (const p of products) {
    if (skipProductIds.has(p.id)) continue;
    const { date, byOpen } = productEffectiveExpiry(p);
    if (!date) continue;
    const threshold = p.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
    const left = daysUntil(date);
    if (left > threshold) continue;
    const onHand = p.batches.reduce((s, b) => s + b.quantity, 0);
    if (onHand <= 0) continue; // hết tồn thì không cảnh báo
    alerts.push({
      batchId: `prod:${p.id}`,
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      warehouse: "—",
      batchCode: byOpen ? "Sau mở nắp" : "HSD bao bì",
      expiryDate: date.toISOString(),
      daysLeft: left,
      quantity: onHand,
      uom: p.uom,
      status: left < 0 ? "EXPIRED" : "NEAR",
    });
  }
  return alerts;
}

export interface LowStockAlert {
  productId: string;
  sku: string;
  name: string;
  uom: string;
  onHand: number;
  minStock: number;
}

/** Sản phẩm có tồn <= định mức tối thiểu. */
export async function getLowStockAlerts(
  warehouseId?: string | null
): Promise<LowStockAlert[]> {
  const rows = await getInventoryRows(warehouseId);
  return rows
    .filter((r) => r.minStock != null && r.onHand <= r.minStock)
    .map((r) => ({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      uom: r.uom,
      onHand: r.onHand,
      minStock: r.minStock as number,
    }))
    // Ưu tiên: thiếu hụt nhiều nhất (minStock - onHand lớn) lên trên.
    .sort((a, b) => (b.minStock - b.onHand) - (a.minStock - a.onHand));
}

export interface WarrantyAlert {
  assetId: string;
  code: string;
  productName: string;
  serialNumber: string | null;
  warrantyUntil: string;
  daysLeft: number;
  status: string;
  isExpired: boolean;
}

/** Hạn bảo hành hiệu lực = ngày nhập trực tiếp, hoặc ngày mua + thời gian BH (tháng). */
export function effectiveWarrantyEnd(a: {
  warrantyUntil: Date | null;
  purchaseDate: Date | null;
  warrantyMonths: number | null;
}): Date | null {
  if (a.warrantyUntil) return a.warrantyUntil;
  if (a.purchaseDate && a.warrantyMonths) {
    const d = new Date(a.purchaseDate);
    d.setMonth(d.getMonth() + a.warrantyMonths);
    return d;
  }
  return null;
}

/** Thiết bị/tài sản sắp hoặc đã hết hạn bảo hành (ngưỡng ngày). */
export async function getWarrantyAlerts(days = 60): Promise<WarrantyAlert[]> {
  const assets = await prisma.asset.findMany({
    where: {
      status: { not: "RETIRED" },
      OR: [{ warrantyUntil: { not: null } }, { AND: [{ warrantyMonths: { not: null } }, { purchaseDate: { not: null } }] }],
    },
    include: { product: true },
  });
  const out: WarrantyAlert[] = [];
  for (const a of assets) {
    const end = effectiveWarrantyEnd(a);
    if (!end) continue;
    const left = daysUntil(end);
    if (left > days) continue;
    out.push({
      assetId: a.id,
      code: a.code,
      productName: a.product.name,
      serialNumber: a.serialNumber,
      warrantyUntil: end.toISOString(),
      daysLeft: left,
      status: a.status,
      isExpired: left < 0,
    });
  }
  return out.sort((x, y) => x.daysLeft - y.daysLeft);
}

export interface MaintenanceDueAlert {
  assetId: string;
  code: string;
  productName: string;
  cycleMonths: number;
  lastMaintenance: string | null;
  nextDue: string;
  daysLeft: number;
  isOverdue: boolean;
}

/** Thiết bị đến/quá hạn bảo trì định kỳ (next = mốc gần nhất + chu kỳ). */
export async function getMaintenanceDueAlerts(withinDays = 14): Promise<MaintenanceDueAlert[]> {
  const assets = await prisma.asset.findMany({
    where: { maintenanceCycleMonths: { not: null }, status: { not: "RETIRED" } },
    include: {
      product: { select: { name: true } },
      maintenance: { orderBy: { performedAt: "desc" }, take: 1, select: { performedAt: true } },
    },
  });
  const out: MaintenanceDueAlert[] = [];
  for (const a of assets) {
    const cycle = a.maintenanceCycleMonths!;
    const base = a.maintenance[0]?.performedAt ?? a.purchaseDate;
    if (!base) continue;
    const next = new Date(base);
    next.setMonth(next.getMonth() + cycle);
    const left = daysUntil(next);
    if (left > withinDays) continue;
    out.push({
      assetId: a.id,
      code: a.code,
      productName: a.product.name,
      cycleMonths: cycle,
      lastMaintenance: a.maintenance[0]?.performedAt?.toISOString() ?? null,
      nextDue: next.toISOString(),
      daysLeft: left,
      isOverdue: left < 0,
    });
  }
  return out.sort((x, y) => x.daysLeft - y.daysLeft);
}

export interface DebtDueAlert {
  assetId: string;
  code: string;
  productName: string;
  dueDate: string;
  remaining: number; // công nợ còn lại
  daysLeft: number;
  isOverdue: boolean;
}

/** Tài sản còn công nợ và sắp/đã đến hạn thanh toán (theo paymentDueDate). */
export async function getDebtDueAlerts(withinDays = 14): Promise<DebtDueAlert[]> {
  const assets = await prisma.asset.findMany({
    where: { paymentDueDate: { not: null }, contractValue: { not: null, gt: 0 } },
    include: {
      product: { select: { name: true } },
      payments: { select: { amount: true } },
    },
  });
  const out: DebtDueAlert[] = [];
  for (const a of assets) {
    const paid = a.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.round((a.contractValue ?? 0) - paid);
    if (remaining <= 0) continue; // đã trả đủ
    const left = daysUntil(a.paymentDueDate!);
    if (left > withinDays) continue;
    out.push({
      assetId: a.id,
      code: a.code,
      productName: a.product.name,
      dueDate: a.paymentDueDate!.toISOString(),
      remaining,
      daysLeft: left,
      isOverdue: left < 0,
    });
  }
  return out.sort((x, y) => x.daysLeft - y.daysLeft);
}

export interface ShotAlert {
  handpieceId: string;
  code: string;
  name: string;
  machine: string | null;
  maxShots: number;
  usedShots: number;
  remaining: number;
  isDepleted: boolean;
}

export interface UnopenedAlert {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  purchaseDate: string;
  monthsStored: number;
  warnMonths: number;
}

/**
 * Sản phẩm đã mua quá lâu mà CHƯA mở nắp (theo ngưỡng storeWarnMonths của nhóm).
 * Nhắc dùng/kiểm tra trước khi để quá lâu ảnh hưởng chất lượng.
 */
export async function getUnopenedStaleAlerts(): Promise<UnopenedAlert[]> {
  const products = await prisma.product.findMany({
    where: { purchaseDate: { not: null }, openedDate: null, isActive: true },
    include: { category: true },
    orderBy: { purchaseDate: "asc" },
  });
  const now = new Date();
  const out: UnopenedAlert[] = [];
  for (const p of products) {
    // Ngưỡng theo nhóm; nếu nhóm chưa cấu hình thì dùng mặc định để cảnh báo vẫn hoạt động.
    const warn = p.category?.storeWarnMonths ?? DEFAULT_STORE_WARN_MONTHS;
    if (!warn || !p.purchaseDate) continue;
    const limit = new Date(p.purchaseDate);
    limit.setMonth(limit.getMonth() + warn);
    if (limit > now) continue; // chưa tới ngưỡng
    const monthsStored = Math.floor((now.getTime() - p.purchaseDate.getTime()) / (30 * MS_PER_DAY));
    out.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? null,
      purchaseDate: p.purchaseDate.toISOString(),
      monthsStored,
      warnMonths: warn,
    });
  }
  return out;
}

/** Tay cầm sắp/đã hết định mức shot (còn lại <= warnShots). */
export async function getShotAlerts(): Promise<ShotAlert[]> {
  const hps = await prisma.handpiece.findMany({
    where: { status: "ACTIVE" },
    include: { asset: { select: { product: { select: { name: true } } } } },
    orderBy: { code: "asc" },
  });
  const out: ShotAlert[] = [];
  for (const h of hps) {
    const remaining = h.maxShots - h.usedShots;
    if (remaining > h.warnShots) continue;
    out.push({
      handpieceId: h.id,
      code: h.code,
      name: h.name,
      machine: h.asset?.product?.name ?? h.machine,
      maxShots: h.maxShots,
      usedShots: h.usedShots,
      remaining,
      isDepleted: remaining <= 0,
    });
  }
  return out;
}

export interface DashboardStats {
  productCount: number;
  totalOnHand: number;
  totalValue: number;
  expiredCount: number;
  nearExpiryCount: number;
  lowStockCount: number;
  receiptsThisMonth: number;
  issuesThisMonth: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [rows, expiry, low, receiptsThisMonth, issuesThisMonth] =
    await Promise.all([
      getInventoryRows(),
      getExpiryAlerts(),
      getLowStockAlerts(),
      countThisMonth("receipt"),
      countThisMonth("issue"),
    ]);

  return {
    productCount: rows.length,
    totalOnHand: rows.reduce((s, r) => s + r.onHand, 0),
    totalValue: rows.reduce((s, r) => s + r.value, 0),
    expiredCount: expiry.filter((e) => e.status === "EXPIRED").length,
    nearExpiryCount: expiry.filter((e) => e.status === "NEAR").length,
    lowStockCount: low.length,
    receiptsThisMonth,
    issuesThisMonth,
  };
}

async function countThisMonth(kind: "receipt" | "issue"): Promise<number> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (kind === "receipt") {
    return prisma.goodsReceipt.count({
      where: { status: "POSTED", receivedAt: { gte: start } },
    });
  }
  return prisma.goodsIssue.count({
    where: { status: "POSTED", issuedAt: { gte: start } },
  });
}
