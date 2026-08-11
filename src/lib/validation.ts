// =============================================================================
// Zod schema cho input các API. Dùng chung giữa route handler và (nếu cần) client.
// =============================================================================
import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

// ----- Nhóm hàng -----
export const categoryCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(120),
  note: optionalString,
});

// ----- Nhà cung cấp -----
export const supplierCreateSchema = z.object({
  code: z.string().trim().min(1, "Bắt buộc").max(30),
  name: z.string().trim().min(1, "Bắt buộc").max(160),
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
  uom: z.string().trim().min(1).max(20).default("Cái"),
  minStock: z.number().nonnegative().nullable().optional(),
  expiryAlertDays: z.number().int().positive().max(3650).nullable().optional(),
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
});

// ----- Người dùng -----
const roleCodes = ["ADMIN", "MANAGER", "WAREHOUSE", "STAFF"] as const;

export const userCreateSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  name: z.string().trim().min(1, "Nhập họ tên").max(120),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  roles: z.array(z.enum(roleCodes)).min(1, "Chọn ít nhất 1 vai trò"),
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
