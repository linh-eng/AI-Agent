// =============================================================================
// Zod schema cho input các API. Dùng chung giữa route handler và (nếu cần) client.
// =============================================================================
import { z } from "zod";

// Chuỗi tùy chọn: chấp nhận cả chuỗi, null và undefined (form gửi "" hoặc null
// khi để trống) — chuẩn hóa về null nếu rỗng.
const optionalString = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

// Ngày tùy chọn: nhận chuỗi "yyyy-mm-dd" (hoặc rỗng/null) -> Date | null để ghi DB.
const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

// ----- Nhóm hàng -----
export const categoryCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(120),
  note: optionalString,
  openMaxMonths: z.number().int().positive().max(120).nullable().optional(),
  storeWarnMonths: z.number().int().positive().max(120).nullable().optional(),
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  note: optionalString,
  openMaxMonths: z.number().int().positive().max(120).nullable().optional(),
  storeWarnMonths: z.number().int().positive().max(120).nullable().optional(),
});

// ----- Thương hiệu -----
export const brandCreateSchema = z.object({
  name: z.string().trim().min(1, "Bắt buộc").max(120),
  note: optionalString,
});

// ----- Nhà cung cấp -----
export const supplierCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(160),
  contactPerson: optionalString,
  phone: optionalString,
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  address: optionalString,
  taxCode: optionalString,
  note: optionalString,
});

// ----- Kho -----
export const warehouseCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(120),
  address: optionalString,
});

// ----- Sản phẩm -----
export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, "Bắt buộc").max(40),
  barcode: optionalString,
  name: z.string().trim().min(1, "Bắt buộc").max(200),
  brand: optionalString,
  categoryId: optionalString,
  trackingMode: z.enum(["LOT", "QUANTITY"]).default("LOT"),
  requiresExpiry: z.boolean().default(false),
  isTester: z.boolean().default(false),
  uom: z.string().trim().min(1).max(20).default("Cái"),
  minStock: z.number().nonnegative().nullable().optional(),
  expiryAlertDays: z.number().int().positive().max(3650).nullable().optional(),
  purchaseDate: optionalDate,
  openedDate: optionalDate,
  expiryDate: optionalDate,
  note: optionalString,
});

// ----- Phiếu nhập -----
export const receiptItemSchema = z.object({
  productId: z.string().min(1, "Chọn sản phẩm"),
  batchCode: optionalString,
  expiryDate: optionalString, // ISO yyyy-mm-dd
  mfgDate: optionalString,
  quantity: z.number().positive("Số lượng > 0"),
  unitCost: z.number().nonnegative().nullable().optional(),
});

export const receiptCreateSchema = z.object({
  supplierId: z.string().min(1, "Chọn nhà cung cấp"),
  warehouseId: z.string().min(1, "Chọn kho"),
  note: optionalString,
  items: z.array(receiptItemSchema).min(1, "Cần ít nhất 1 dòng hàng"),
});

// Lý do khi hủy/sửa phiếu (bắt buộc, tối thiểu 3 ký tự).
export const cancelReasonSchema = z.object({
  reason: z.string().trim().min(3, "Nhập lý do (tối thiểu 3 ký tự)").max(300),
});

// Sửa phiếu = hủy phiếu cũ + tạo phiếu mới; cần đủ dữ liệu phiếu + lý do sửa.
export const receiptUpdateSchema = receiptCreateSchema.extend({
  reason: z.string().trim().min(3, "Nhập lý do sửa (tối thiểu 3 ký tự)").max(300),
});

// ----- Phiếu xuất -----
export const issueItemSchema = z.object({
  productId: z.string().min(1, "Chọn sản phẩm"),
  quantity: z.number().positive("Số lượng > 0"),
  batchId: optionalString, // nếu để trống -> tự phân bổ FEFO
});

export const issueCreateSchema = z.object({
  warehouseId: z.string().min(1, "Chọn kho"),
  issueType: z.enum(["SALE", "INTERNAL_USE", "DISPOSAL", "ADJUSTMENT"]),
  customerName: optionalString,
  note: optionalString,
  items: z.array(issueItemSchema).min(1, "Cần ít nhất 1 dòng hàng"),
});

export const issueUpdateSchema = issueCreateSchema.extend({
  reason: z.string().trim().min(3, "Nhập lý do sửa (tối thiểu 3 ký tự)").max(300),
});

export type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>;
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;

// ----- Chuyển kho -----
export const transferCreateSchema = z.object({
  fromWarehouseId: z.string().min(1, "Chọn kho nguồn"),
  toWarehouseId: z.string().min(1, "Chọn kho đích"),
  note: optionalString,
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Chọn sản phẩm"),
        quantity: z.number().positive("Số lượng > 0"),
      })
    )
    .min(1, "Cần ít nhất 1 dòng hàng"),
});

// ----- Dịch vụ / liệu trình -----
export const serviceCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(160),
  price: z.number().nonnegative().nullable().optional(),
  note: optionalString,
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Chọn sản phẩm"),
        quantity: z.number().positive("Định mức > 0"),
      })
    )
    .default([]),
});

export const serviceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  price: z.number().nonnegative().nullable().optional(),
  note: optionalString,
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .optional(),
});

// ----- Kiểm kê -----
export const stockCountCreateSchema = z.object({
  warehouseId: z.string().min(1, "Chọn kho"),
  note: optionalString,
});

export const stockCountPostSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        countedQty: z.number().nonnegative("Số đếm >= 0"),
      })
    )
    .min(1, "Không có dòng kiểm kê"),
});

// ----- Bảo trì thiết bị -----
export const maintenanceCreateSchema = z.object({
  type: z.enum(["MAINTENANCE", "REPAIR", "INSPECTION"]).default("MAINTENANCE"),
  description: z.string().trim().min(1, "Nhập nội dung"),
  cost: z.number().nonnegative().nullable().optional(),
  vendor: optionalString,
  performedAt: z.string().min(1, "Chọn ngày thực hiện"),
  note: optionalString,
});

export const serviceUsageSchema = z.object({
  serviceId: z.string().min(1, "Chọn dịch vụ"),
  warehouseId: z.string().min(1, "Chọn kho"),
  sessions: z.number().int().positive("Số lượt >= 1").default(1),
  customerName: optionalString,
  note: optionalString,
});

// ----- Tài sản / thiết bị -----
// Trường khấu hao + bảo hành/bảo trì (dùng chung create & update).
const assetExtraFields = {
  cost: z.number().nonnegative().nullable().optional(),
  salvageValue: z.number().nonnegative().nullable().optional(),
  depreciationStart: optionalString,
  depreciationMonths: z.number().int().positive().max(1200).nullable().optional(),
  depreciationMethod: z.enum(["STRAIGHT_LINE", "DECLINING", "UNITS"]).nullable().optional(),
  depreciationTotalUnits: z.number().positive().nullable().optional(),
  warrantyVendor: optionalString,
  warrantyMonths: z.number().int().positive().max(600).nullable().optional(),
  maintenanceCycleMonths: z.number().int().positive().max(600).nullable().optional(),
  contractValue: z.number().nonnegative().nullable().optional(),
  managementType: z.enum(["DEBT", "INVOICE", "CONTRACT"]).nullable().optional(),
};

// Ghi nhận sản lượng (khấu hao theo sản lượng).
export const depreciationUsageSchema = z.object({
  usageDate: z.string().min(1, "Chọn ngày"),
  units: z.number().positive("Sản lượng > 0"),
  note: optionalString,
});

// Đợt thanh toán tài sản.
export const assetPaymentSchema = z.object({
  amount: z.number().positive("Số tiền > 0"),
  paidDate: z.string().min(1, "Chọn ngày thanh toán"),
  method: z.enum(["CASH", "TRANSFER", "OTHER"]).default("TRANSFER"),
  bankInfo: optionalString,
  payerType: z.enum(["COMPANY", "PERSONAL_ADVANCE", "OTHER"]).default("COMPANY"),
  note: optionalString,
});

// File đính kèm tài sản (data URI base64). Giới hạn ~5MB.
export const assetAttachmentSchema = z.object({
  kind: z.enum(["CONTRACT", "INVOICE", "PAYMENT_ORDER", "OTHER"]).default("OTHER"),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  data: z.string().min(1).max(7_500_000), // base64 ~5MB
  size: z.number().int().nonnegative().max(5_242_880, "File tối đa 5MB"),
  paymentId: optionalString,
  note: optionalString,
});

export const assetCreateSchema = z.object({
  productId: z.string().min(1, "Chọn thiết bị"),
  code: optionalString, // để trống -> sinh tự động
  serialNumber: optionalString,
  warehouseId: optionalString,
  status: z.enum(["IN_STOCK", "IN_USE", "MAINTENANCE", "RETIRED"]).default("IN_STOCK"),
  location: optionalString,
  purchaseDate: optionalString,
  warrantyUntil: optionalString,
  supplierId: optionalString,
  note: optionalString,
  ...assetExtraFields,
});

export const assetUpdateSchema = z.object({
  serialNumber: optionalString,
  warehouseId: optionalString,
  status: z.enum(["IN_STOCK", "IN_USE", "MAINTENANCE", "RETIRED"]).optional(),
  location: optionalString,
  purchaseDate: optionalString,
  warrantyUntil: optionalString,
  supplierId: optionalString,
  note: optionalString,
  ...assetExtraFields,
});

// ----- Tay cầm / vật tư theo máy (đếm shot) -----
export const handpieceCreateSchema = z.object({
  code: optionalString, // để trống -> sinh tự động TC-xxxx
  name: z.string().trim().min(1, "Nhập tên tay cầm").max(160),
  assetId: optionalString,
  machine: optionalString,
  maxShots: z.number().int().positive("Định mức shot > 0"),
  usedShots: z.number().int().nonnegative().default(0),
  warnShots: z.number().int().nonnegative().max(1_000_000).default(1000),
  note: optionalString,
});

export const handpieceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  assetId: optionalString,
  machine: optionalString,
  maxShots: z.number().int().positive().optional(),
  warnShots: z.number().int().nonnegative().max(1_000_000).optional(),
  status: z.enum(["ACTIVE", "RETIRED"]).optional(),
  note: optionalString,
});

export const shotLogSchema = z.object({
  shots: z.number().int().positive("Số shot > 0"),
  customerName: optionalString,
  performedAt: optionalString,
  note: optionalString,
});

// ----- Người dùng -----
const roleCodes = ["ADMIN", "MANAGER", "WAREHOUSE", "STAFF"] as const;

export const userCreateSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  name: z.string().trim().min(1, "Nhập họ tên").max(120),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  roles: z.array(z.enum(roleCodes)).min(1, "Chọn ít nhất 1 vai trò"),
});

// Đổi mật khẩu của chính mình (mọi người dùng đã đăng nhập).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roles: z.array(z.enum(roleCodes)).min(1, "Chọn ít nhất 1 vai trò").optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").optional(),
});

// ----- Cài đặt công ty -----
export const settingUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên công ty").max(160),
  logo: z.string().nullable().optional(), // data URI hoặc null
  address: optionalString,
  phone: optionalString,
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  taxCode: optionalString,
});

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type ServiceUsageInput = z.infer<typeof serviceUsageSchema>;
