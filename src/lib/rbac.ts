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

  // --- Module Spa / Thẩm mỹ (Khách hàng · Booking · Phác đồ · Chi phí) ---
  MANAGER: "MANAGER", // Quản lý spa — xem toàn bộ + duyệt
  RECEPTION: "RECEPTION", // Lễ tân — tạo khách, đặt lịch, thu tiền
  CUSTOMER_CARE: "CUSTOMER_CARE", // CSKH — nhật ký chăm sóc, follow-up, task
  SPECIALIST: "SPECIALIST", // Chuyên viên — đánh giá, thiết kế phác đồ, thực hiện buổi
  CASHIER: "CASHIER", // Thu ngân / Kế toán spa — thanh toán, công nợ, tài chính
  MARKETING: "MARKETING", // Marketing — chiến dịch, nguồn khách, báo cáo
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

  MANAGER: "Quản lý Spa",
  RECEPTION: "Lễ tân",
  CUSTOMER_CARE: "CSKH",
  SPECIALIST: "Chuyên viên",
  CASHIER: "Thu ngân / Kế toán",
  MARKETING: "Marketing",
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

  // --- Module Spa / Thẩm mỹ ---
  CUSTOMER_READ: "customer.read",
  CUSTOMER_WRITE: "customer.write",
  CRM_WRITE: "crm.write", // ghi nhật ký CSKH
  SERVICE_READ: "service.read",
  SERVICE_WRITE: "service.write",
  BOOKING_READ: "booking.read",
  BOOKING_WRITE: "booking.write",
  TREATMENT_READ: "treatment.read", // xem phác đồ + buổi
  TREATMENT_WRITE: "treatment.write", // thiết kế phác đồ, ghi buổi, đánh giá
  PAYMENT_READ: "payment.read",
  PAYMENT_WRITE: "payment.write",
  INVOICE_READ: "invoice.read", // xem hóa đơn & công nợ
  INVOICE_WRITE: "invoice.write", // tạo/hủy hóa đơn (mục 18)
  SETTING_WRITE: "setting.write", // cấu hình hệ thống (Thương hiệu, mục 1)
  HR_READ: "hr.read", // xem danh sách nhân sự (mục 22)
  HR_WRITE: "hr.write", // thêm/sửa nhân sự + gán nhân sự buổi kèm phí
  PRICEFLOOR_WRITE: "pricefloor.write", // khai báo cấu trúc chi phí + giá sàn (mục 25)
  PRICEFLOOR_OVERRIDE: "pricefloor.override", // duyệt bán DƯỚI giá sàn (mục 26)
  FOLLOWUP_WRITE: "followup.write", // quản lý quy trình CSKH follow-up (mục 31)
  TASK_WRITE: "task.write",
  CAMPAIGN_WRITE: "campaign.write",
  /// Dữ liệu tài chính nhạy cảm: giá vốn, chi phí, lợi nhuận (mục 24)
  FINANCE_READ: "finance.read",

  // --- Thư viện & Protocol/Form Builder & Product catalog ---
  LIBRARY_READ: "library.read", // đọc brand/technology/protocol/product/form
  BRAND_WRITE: "brand.write",
  TECHNOLOGY_WRITE: "technology.write",
  PROTOCOL_WRITE: "protocol.write", // brand/internal protocol library
  PROTOCOL_APPROVE: "protocol.approve", // duyệt protocol/form (Draft→…→Active)
  FORM_WRITE: "form.write", // thiết kế biểu mẫu (protocol/form builder)
  CATALOG_WRITE: "catalog.write", // product catalog (SpaProduct)
  RECOMMEND_WRITE: "recommend.write", // đề xuất sản phẩm cho khách

  // --- Module 5–10 ---
  PROPOSAL_READ: "proposal.read",
  PROPOSAL_WRITE: "proposal.write", // lập/sửa phương án báo giá
  PROPOSAL_ACCEPT: "proposal.accept", // ghi nhận khách chốt phương án
  CARE_WRITE: "care.write", // thư viện + gửi hướng dẫn pre/post-care
  MATERIAL_WRITE: "material.write", // yêu cầu/xuất/tiêu hao vật tư buổi
  PRICE_READ: "price.read",
  PRICE_WRITE: "price.write", // quản lý bảng giá có version
  MARKETING_READ: "marketing.read",
  MARKETING_WRITE: "marketing.write", // chiến dịch/lead/ROI
  MEDIA_WRITE: "media.write", // upload/xóa media (ảnh khách, before/after, tệp)
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

/** Quyền đọc cơ bản của module Spa — mọi vai trò spa đều cần. */
const CLINIC_READ: PermissionCode[] = [
  PERMISSIONS.CUSTOMER_READ,
  PERMISSIONS.SERVICE_READ,
  PERMISSIONS.BOOKING_READ,
  PERMISSIONS.TREATMENT_READ,
  PERMISSIONS.LIBRARY_READ,
  PERMISSIONS.PROPOSAL_READ,
  PERMISSIONS.PRICE_READ,
  PERMISSIONS.INVOICE_READ,
  PERMISSIONS.HR_READ,
];

/**
 * Ma trận vai trò → quyền (mục 4).
 * ADMIN nhận toàn bộ; các vai trò khác nhận đúng phạm vi nghiệp vụ.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,

  // BGĐ: xem tất cả + các quyền duyệt (kể cả tài chính & tổng quan spa)
  BOD: [
    ...CATALOG_READ,
    ...CLINIC_READ,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_APPROVE,
    PERMISSIONS.DISASSEMBLY_APPROVE,
    PERMISSIONS.STOCKCOUNT_APPROVE,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.PROTOCOL_APPROVE,
    PERMISSIONS.PRICEFLOOR_OVERRIDE,
    PERMISSIONS.MARKETING_READ,
  ],

  // Mua hàng: tạo PO/đề nghị nhập
  PURCHASING: [...CATALOG_READ, PERMISSIONS.PARTNER_WRITE, PERMISSIONS.INBOUND_WRITE],

  // Kế toán kho: nhập hệ thống, gán SKU/barcode, duyệt xuất
  WH_ACCOUNTANT: [
    ...CATALOG_READ,
    PERMISSIONS.PRODUCT_WRITE,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.PARTNER_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_APPROVE,
  ],

  // Thủ kho: nhận hàng, quét serial, scan-to-bin
  WAREHOUSE_KEEPER: [
    ...CATALOG_READ,
    PERMISSIONS.WAREHOUSE_WRITE,
    PERMISSIONS.BIN_WRITE,
    PERMISSIONS.INBOUND_WRITE,
    PERMISSIONS.OUTBOUND_WRITE,
  ],

  // Kỹ thuật/Lắp ráp
  TECH: [...CATALOG_READ, PERMISSIONS.WORKORDER_WRITE, PERMISSIONS.QC_WRITE],

  // QC
  QC: [...CATALOG_READ, PERMISSIONS.QC_WRITE],

  // Kinh doanh: tạo SO, lệnh lắp ráp
  SALES: [...CATALOG_READ, PERMISSIONS.OUTBOUND_WRITE, PERMISSIONS.WORKORDER_WRITE],

  // Bảo hành/Dịch vụ
  WARRANTY: [...CATALOG_READ, PERMISSIONS.WARRANTY_WRITE],

  // --- Module Spa / Thẩm mỹ ---

  // Quản lý Spa: xem toàn bộ nghiệp vụ spa + tài chính + duyệt
  MANAGER: [
    ...CLINIC_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.SERVICE_WRITE,
    PERMISSIONS.BOOKING_WRITE,
    PERMISSIONS.TREATMENT_WRITE,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_WRITE,
    PERMISSIONS.INVOICE_WRITE,
    PERMISSIONS.SETTING_WRITE,
    PERMISSIONS.HR_WRITE,
    PERMISSIONS.PRICEFLOOR_WRITE,
    PERMISSIONS.PRICEFLOOR_OVERRIDE,
    PERMISSIONS.FOLLOWUP_WRITE,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.BRAND_WRITE,
    PERMISSIONS.TECHNOLOGY_WRITE,
    PERMISSIONS.PROTOCOL_WRITE,
    PERMISSIONS.PROTOCOL_APPROVE,
    PERMISSIONS.FORM_WRITE,
    PERMISSIONS.CATALOG_WRITE,
    PERMISSIONS.RECOMMEND_WRITE,
    PERMISSIONS.PROPOSAL_WRITE,
    PERMISSIONS.PROPOSAL_ACCEPT,
    PERMISSIONS.CARE_WRITE,
    PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.PRICE_WRITE,
    PERMISSIONS.MARKETING_READ,
    PERMISSIONS.MARKETING_WRITE,
    PERMISSIONS.MEDIA_WRITE,
  ],

  // Lễ tân: tạo khách, đặt lịch, nhận thanh toán, chốt phương án, gửi hướng dẫn
  RECEPTION: [
    ...CLINIC_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.BOOKING_WRITE,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_WRITE,
    PERMISSIONS.INVOICE_WRITE,
    PERMISSIONS.HR_WRITE,
    PERMISSIONS.FOLLOWUP_WRITE,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.PROPOSAL_ACCEPT,
    PERMISSIONS.CARE_WRITE,
    PERMISSIONS.MEDIA_WRITE,
  ],

  // CSKH: nhật ký chăm sóc, follow-up, task (không xem tài chính)
  CUSTOMER_CARE: [
    ...CLINIC_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.FOLLOWUP_WRITE,
    PERMISSIONS.MEDIA_WRITE,
  ],

  // Chuyên viên: đánh giá, thiết kế phác đồ/protocol/biểu mẫu, đề xuất, phương án, vật tư
  SPECIALIST: [
    ...CLINIC_READ,
    PERMISSIONS.TREATMENT_WRITE,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.TASK_WRITE,
    PERMISSIONS.PROTOCOL_WRITE,
    PERMISSIONS.TECHNOLOGY_WRITE,
    PERMISSIONS.FORM_WRITE,
    PERMISSIONS.RECOMMEND_WRITE,
    PERMISSIONS.PROPOSAL_WRITE,
    PERMISSIONS.CARE_WRITE,
    PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.MEDIA_WRITE,
  ],

  // Thu ngân / Kế toán: thanh toán, công nợ, tài chính, bảng giá
  CASHIER: [
    ...CLINIC_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_WRITE,
    PERMISSIONS.INVOICE_WRITE,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.PRICE_WRITE,
    PERMISSIONS.PRICEFLOOR_WRITE,
  ],

  // Marketing: chiến dịch, nguồn khách, catalog sản phẩm bán lẻ, ROI, báo cáo
  MARKETING: [
    ...CLINIC_READ,
    PERMISSIONS.CAMPAIGN_WRITE,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.CATALOG_WRITE,
    PERMISSIONS.MARKETING_READ,
    PERMISSIONS.MARKETING_WRITE,
  ],
};

/** Kiểm tra tập quyền có chứa quyền yêu cầu. */
export function can(
  userPermissions: Iterable<string>,
  required: PermissionCode
): boolean {
  const set = userPermissions instanceof Set ? userPermissions : new Set(userPermissions);
  return set.has(required);
}
