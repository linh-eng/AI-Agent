// =============================================================================
// Dọn dữ liệu nghiệp vụ (xóa dữ liệu demo) — GIỮ LẠI phần Hệ thống:
//   người dùng, vai trò, quyền, phân quyền, cài đặt công ty.
// Xóa: sản phẩm, nhóm hàng, thương hiệu, NCC, kho, lô/tồn, phiếu nhập/xuất/chuyển,
//      kiểm kê, dịch vụ + ghi nhận, tài sản, tay cầm/shot, bảo trì, sổ biến động,
//      nhật ký (audit demo).
// CẢNH BÁO: không thể hoàn tác — nên tải bản sao lưu trước.
// =============================================================================
import { prisma } from "./prisma";

// Xóa theo thứ tự con -> cha để an toàn khoá ngoại.
const CLEAR_ORDER = [
  "auditLog",
  "maintenanceLog",
  "stockCountItem",
  "stockCount",
  "shotLog",
  "handpiece",
  "assetAttachment",
  "assetPayment",
  "asset",
  "serviceStockItem",
  "serviceUsage",
  "serviceItem",
  "service",
  "stockTransferItem",
  "stockTransfer",
  "stockMovement",
  "goodsIssueItem",
  "goodsIssue",
  "goodsReceiptItem",
  "goodsReceipt",
  "stockBatch",
  "product",
  "brand",
  "category",
  "supplier",
  "warehouse",
] as const;

// Các bảng KHÔNG đụng tới (phần Hệ thống): user, role, permission, userRole,
// rolePermission, companySetting.

type Delegate = { deleteMany: (a: unknown) => Promise<{ count: number }> };

/** Xóa toàn bộ dữ liệu nghiệp vụ trong 1 transaction. Trả về số bản ghi đã xóa. */
export async function clearBusinessData(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const name of CLEAR_ORDER) {
        const delegate = (tx as unknown as Record<string, Delegate>)[name];
        const res = await delegate.deleteMany({});
        counts[name] = res.count;
      }
    },
    { timeout: 120_000, maxWait: 120_000 }
  );
  return counts;
}
