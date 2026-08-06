// =============================================================================
// RBAC — danh mục vai trò & quyền (mục 4 bản mô tả yêu cầu)
// Nguồn sự thật cho seed và cho việc kiểm quyền phía server.
// =============================================================================

/** Mã vai trò. */
export const ROLES = {
  ADMIN: "ADMIN",
  BOD: "BOD", // Ban Giám đốc
  PURCHASING: "PURCHASING", // Mua hàng
  WH_ACCOUNTANT: "WH_ACCOUNTANT", // Kế toán kho
  WAREHOUSE_KEEPER: "WAREHOUSE_KEEPER", // Thủ kho
  TECH: "TECH", // Kỹ thuật/Lắp ráp
  QC: "QC", // QC
  SALES: "SALES", // Kinh doanh
  WARRANTY: "WARRANTY", // Bảo hành/Dịch vụ
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Admin",
  BOD: "Ban Giám đốc",
  PURCHASING: "Mua hàng",
  WH_ACCOUNTANT: "Kế toán kho",
  WAREHOUSE_KEEPER: "Thủ kho",
  TECH: "Kỹ thuật/Lắp ráp",
  QC: "QC",
  SALES: "Kinh doanh",
  WARRANTY: "Bảo hành/Dịch vụ",
};

// -----------------------------------------------------------------------------
// Quyền: dạng "<resource>.<action>". action: read | write | approve
// -----------------------------------------------------------------------------
export const PERMISSIONS = {
  // Danh mục (Phase 1)
  WAREHOUSE_READ: "warehouse.read",
  WAREHOUSE_WRITE: "warehouse.write",
  PROJECT_READ: "project.read",
  PROJECT_WRITE: "project.write",
  PARTNER_READ: "partner.read",
  PARTNER_WRITE: "partner.write",
  PRODUCT_READ: "product.read",
  PRODUCT_WRITE: "product.write",
  BIN_READ: "bin.read",
  BIN_WRITE: "bin.write",

  // Nghiệp vụ (Phase sau — đã khai báo để RBAC đầy đủ)
  INBOUND_WRITE: "inbound.write",
  OUTBOUND_WRITE: "outbound.write",
  OUTBOUND_APPROVE: "outbound.approve",
  WORKORDER_WRITE: "workorder.write",
  QC_WRITE: "qc.write",
  WARRANTY_WRITE: "warranty.write",
  DISASSEMBLY_APPROVE: "disassembly.approve",
  STOCKCOUNT_APPROVE: "stockcount.approve",
  USER_MANAGE: "user.manage",

  // --- v1.5 ---
  REQUEST_WRITE: "request.write", // tạo/gửi yêu cầu (5A-0)
  REQUEST_RECEIVE: "request.receive", // tiếp nhận & gán người phụ trách (kho)
  UNLOCK_APPROVE: "unlock.approve", // duyệt mở khóa hàng dự án (YCU / C8)
  RECEIVING_WRITE: "receiving.write", // nhận hàng vật lý Zone TN (5A-2)
  TESTING_WRITE: "testing.write", // nhập biên bản testing (5A-2)
  MILESTONE_WRITE: "milestone.write", // kế hoạch giao dự án theo mốc (5D-1)
  FINANCE_READ: "finance.read", // xem số tiền công nợ (5L)
  FINANCE_WRITE: "finance.write", // ghi nhận thanh toán AP/AR (5L)
  IMPORT_CATALOG: "import.catalog", // nạp file danh mục (5M-D)
  IMPORT_SERIAL: "import.serial", // nạp file serial/testing (5M-D)
  IMPORT_FINANCE: "import.finance", // nạp file công nợ (5M-D)
  MAIL_MANAGE: "mail.manage", // quản trị mẫu mail (mục 6.5)
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

/** Quyền đọc danh mục — hầu hết vai trò đều cần để thao tác. */
const CATALOG_READ: PermissionCode[] = [
  PERMISSIONS.WAREHOUSE_READ,
  PERMISSIONS.PROJECT_READ,
  PERMISSIONS.PARTNER_READ,
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.BIN_READ,
];

/**
 * Ma trận vai trò → quyền (mục 4).
 * ADMIN nhận toàn bộ; các vai trò khác nhận đúng phạm vi nghiệp vụ.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,

  // BGĐ: xem tất cả + các quyền duyệt (gồm mở khóa, xem tiền)
  BOD: [
    ...CATALOG_READ,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_APPROVE,
    PERMISSIONS.DISASSEMBLY_APPROVE,
    PERMISSIONS.STOCKCOUNT_APPROVE,
    PERMISSIONS.REQUEST_WRITE,
    PERMISSIONS.UNLOCK_APPROVE,
    PERMISSIONS.FINANCE_READ,
  ],

  // Mua hàng: tạo PO/đề nghị nhập, tạo YCKT, xem công nợ phải trả NCC
  PURCHASING: [
    ...CATALOG_READ,
    PERMISSIONS.PARTNER_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.REQUEST_WRITE,
    PERMISSIONS.RECEIVING_WRITE,
    PERMISSIONS.FINANCE_READ, // chỉ AP — lọc ở tầng server (5L)
  ],

  // Kế toán kho: nhập hệ thống, tiếp nhận yêu cầu, duyệt xuất, quản công nợ đầy đủ, nạp file
  WH_ACCOUNTANT: [
    ...CATALOG_READ,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.PARTNER_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_APPROVE,
    PERMISSIONS.REQUEST_RECEIVE,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_WRITE,
    PERMISSIONS.IMPORT_CATALOG,
    PERMISSIONS.IMPORT_FINANCE,
  ],

  // Thủ kho: nhận hàng, quét serial, scan-to-bin, tiếp nhận yêu cầu, nhận vật lý Zone TN
  WAREHOUSE_KEEPER: [
    ...CATALOG_READ,
    PERMISSIONS.WAREHOUSE_WRITE,
    PERMISSIONS.BIN_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_WRITE,
    PERMISSIONS.REQUEST_RECEIVE,
    PERMISSIONS.RECEIVING_WRITE,
    PERMISSIONS.IMPORT_SERIAL,
  ],

  // Kỹ thuật/Lắp ráp: + testing (5A-2), tạo yêu cầu (linh kiện lắp ráp)
  TECH: [
    ...CATALOG_READ,
    PERMISSIONS.WORKORDER_WRITE,
    PERMISSIONS.QC_WRITE,
    PERMISSIONS.REQUEST_WRITE,
    PERMISSIONS.TESTING_WRITE,
    PERMISSIONS.IMPORT_SERIAL,
  ],

  // QC: + testing
  QC: [...CATALOG_READ, PERMISSIONS.QC_WRITE, PERMISSIONS.TESTING_WRITE],

  // Kinh doanh: tạo SO, lệnh lắp ráp, tạo yêu cầu, mở khóa/giữ hàng dự án, kế hoạch mốc, xem công nợ khách mình
  SALES: [
    ...CATALOG_READ,
    PERMISSIONS.OUTBOUND_WRITE,
    PERMISSIONS.WORKORDER_WRITE,
    PERMISSIONS.REQUEST_WRITE,
    PERMISSIONS.UNLOCK_APPROVE,
    PERMISSIONS.MILESTONE_WRITE,
    PERMISSIONS.FINANCE_READ, // chỉ khách mình phụ trách — lọc ở server (C55)
  ],

  // Bảo hành/Dịch vụ: + tạo yêu cầu
  WARRANTY: [...CATALOG_READ, PERMISSIONS.WARRANTY_WRITE, PERMISSIONS.REQUEST_WRITE],
};

/** Kiểm tra tập quyền có chứa quyền yêu cầu. */
export function can(
  userPermissions: Iterable<string>,
  required: PermissionCode
): boolean {
  const set = userPermissions instanceof Set ? userPermissions : new Set(userPermissions);
  return set.has(required);
}
