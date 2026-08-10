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
