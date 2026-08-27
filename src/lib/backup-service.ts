// =============================================================================
// Sao lưu & phục hồi TOÀN BỘ dữ liệu ra/từ một tệp JSON.
// - Sao lưu: đọc mọi bảng qua Prisma -> 1 object JSON (kèm logo công ty vì logo
//   lưu ngay trong DB dạng data URI, không có tệp rời).
// - Phục hồi: xoá sạch rồi nạp lại theo đúng thứ tự khoá ngoại trong 1 transaction.
// CẢNH BÁO: phục hồi GHI ĐÈ toàn bộ dữ liệu hiện tại.
// =============================================================================
import { prisma } from "./prisma";
import { HttpError } from "./session";
import { APP_VERSION } from "./version";

// Thứ tự nạp: cha trước, con sau (an toàn khoá ngoại). Xoá theo thứ tự ngược lại.
// Tên = tên delegate của Prisma (camelCase của model).
const MODEL_ORDER = [
  "permission",
  "role",
  "user",
  "rolePermission",
  "userRole",
  "warehouse",
  "supplier",
  "category",
  "brand",
  "product",
  "stockBatch",
  "goodsReceipt",
  "goodsReceiptItem",
  "goodsIssue",
  "goodsIssueItem",
  "stockMovement",
  "stockTransfer",
  "stockTransferItem",
  "service",
  "serviceItem",
  "serviceUsage",
  "serviceStockItem",
  "asset",
  "assetPayment",
  "assetAttachment",
  "depreciationUsage",
  "handpiece",
  "shotLog",
  "stockCount",
  "stockCountItem",
  "maintenanceLog",
  "companySetting",
  "auditLog",
] as const;

type Delegate = { findMany: () => Promise<unknown[]>; deleteMany: (a: unknown) => Promise<unknown>; createMany: (a: unknown) => Promise<{ count: number }> };
function db(tx: unknown, name: string): Delegate {
  return (tx as Record<string, Delegate>)[name];
}

export interface BackupFile {
  app: "sophia-wellness";
  version: string;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

/** Đọc toàn bộ dữ liệu thành object JSON để tải về. */
export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const name of MODEL_ORDER) {
    data[name] = await db(prisma, name).findMany();
  }
  return {
    app: "sophia-wellness",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// Chuyển chuỗi ISO 8601 trong JSON về Date để Prisma ghi đúng kiểu DateTime.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
export function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_RE.test(value)) return new Date(value);
  return value;
}

/**
 * Phục hồi từ object đã parse (dùng reviveDates). Xoá sạch mọi bảng rồi nạp lại.
 * Trả về số bản ghi đã nạp theo từng bảng.
 */
export async function importBackup(backup: BackupFile): Promise<Record<string, number>> {
  if (!backup || backup.app !== "sophia-wellness" || typeof backup.data !== "object") {
    throw new HttpError(400, "Tệp sao lưu không hợp lệ (không đúng định dạng Sophia Wellness).");
  }
  const counts: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // Xoá theo thứ tự ngược (con trước, cha sau).
      for (let i = MODEL_ORDER.length - 1; i >= 0; i--) {
        await db(tx, MODEL_ORDER[i]).deleteMany({});
      }
      // Nạp theo thứ tự xuôi (cha trước, con sau).
      for (const name of MODEL_ORDER) {
        const rows = backup.data[name];
        if (Array.isArray(rows) && rows.length > 0) {
          const res = await db(tx, name).createMany({ data: rows });
          counts[name] = res.count;
        } else {
          counts[name] = 0;
        }
      }
    },
    { timeout: 120_000, maxWait: 120_000 }
  );

  return counts;
}
