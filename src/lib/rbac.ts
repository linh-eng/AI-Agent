// =============================================================================
// RBAC — vai trò & quyền cho Sophia Wellness. Nguồn sự thật dùng chung cho
// seed và kiểm quyền phía server.
// =============================================================================

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER", // Quản lý — xem tất cả, sửa danh mục, duyệt
  WAREHOUSE: "WAREHOUSE", // Thủ kho — nhập/xuất kho
  STAFF: "STAFF", // Nhân viên — xem tồn, tạo phiếu xuất dùng nội bộ
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  WAREHOUSE: "Thủ kho",
  STAFF: "Nhân viên",
};

// Quyền dạng "<resource>.<action>".
export const PERMISSIONS = {
  CATEGORY_READ: "category.read",
  CATEGORY_WRITE: "category.write",
  SUPPLIER_READ: "supplier.read",
  SUPPLIER_WRITE: "supplier.write",
  PRODUCT_READ: "product.read",
  PRODUCT_WRITE: "product.write",
  WAREHOUSE_READ: "warehouse.read",
  WAREHOUSE_WRITE: "warehouse.write",

  INVENTORY_READ: "inventory.read",
  INBOUND_WRITE: "inbound.write",
  INBOUND_MANAGE: "inbound.manage", // sửa/hủy phiếu nhập đã ghi sổ (ADMIN/MANAGER)
  OUTBOUND_WRITE: "outbound.write",
  OUTBOUND_MANAGE: "outbound.manage", // sửa/hủy phiếu xuất đã ghi sổ (ADMIN/MANAGER)
  TRANSFER_WRITE: "transfer.write",
  STOCKCOUNT_WRITE: "stockcount.write",

  SERVICE_READ: "service.read",
  SERVICE_WRITE: "service.write", // quản lý liệu trình + định mức
  SERVICE_USE: "service.use", // ghi nhận thực hiện dịch vụ (trừ kho)

  ASSET_READ: "asset.read",
  ASSET_WRITE: "asset.write",

  REPORT_READ: "report.read",

  SETTING_MANAGE: "setting.manage",
  USER_MANAGE: "user.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  "category.read": "Xem nhóm hàng",
  "category.write": "Sửa nhóm hàng",
  "supplier.read": "Xem nhà cung cấp",
  "supplier.write": "Sửa nhà cung cấp",
  "product.read": "Xem sản phẩm",
  "product.write": "Sửa sản phẩm",
  "warehouse.read": "Xem kho",
  "warehouse.write": "Sửa kho",
  "inventory.read": "Xem tồn kho",
  "inbound.write": "Nhập kho",
  "inbound.manage": "Sửa/hủy phiếu nhập",
  "outbound.write": "Xuất kho",
  "outbound.manage": "Sửa/hủy phiếu xuất",
  "transfer.write": "Chuyển kho",
  "stockcount.write": "Kiểm kê kho",
  "service.read": "Xem liệu trình dịch vụ",
  "service.write": "Quản lý liệu trình dịch vụ",
  "service.use": "Ghi nhận thực hiện dịch vụ",
  "asset.read": "Xem tài sản/thiết bị",
  "asset.write": "Quản lý tài sản/thiết bị",
  "report.read": "Xem báo cáo",
  "setting.manage": "Cài đặt công ty",
  "user.manage": "Quản trị người dùng",
};

const READ_ALL: PermissionCode[] = [
  PERMISSIONS.CATEGORY_READ,
  PERMISSIONS.SUPPLIER_READ,
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.WAREHOUSE_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.SERVICE_READ,
  PERMISSIONS.ASSET_READ,
  PERMISSIONS.REPORT_READ,
];

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,

  MANAGER: [
    ...READ_ALL,
    PERMISSIONS.CATEGORY_WRITE,
    PERMISSIONS.SUPPLIER_WRITE,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.WAREHOUSE_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.INBOUND_MANAGE,
    PERMISSIONS.OUTBOUND_WRITE,
    PERMISSIONS.OUTBOUND_MANAGE,
    PERMISSIONS.TRANSFER_WRITE,
    PERMISSIONS.STOCKCOUNT_WRITE,
    PERMISSIONS.SERVICE_WRITE,
    PERMISSIONS.SERVICE_USE,
    PERMISSIONS.ASSET_WRITE,
    PERMISSIONS.SETTING_MANAGE,
  ],

  WAREHOUSE: [
    ...READ_ALL,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.SUPPLIER_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_WRITE,
    PERMISSIONS.TRANSFER_WRITE,
    PERMISSIONS.STOCKCOUNT_WRITE,
    PERMISSIONS.SERVICE_USE,
    PERMISSIONS.ASSET_WRITE,
  ],

  STAFF: [...READ_ALL, PERMISSIONS.OUTBOUND_WRITE, PERMISSIONS.SERVICE_USE],
};

export function can(
  userPermissions: Iterable<string>,
  required: PermissionCode
): boolean {
  const set =
    userPermissions instanceof Set ? userPermissions : new Set(userPermissions);
  return set.has(required);
}
