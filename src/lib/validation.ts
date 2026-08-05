// =============================================================================
// Zod schema kiểm dữ liệu đầu vào API.
// Bao gồm ràng buộc nghiệp vụ "projectId khác null HOẶC isCommercialStock".
// =============================================================================
import { z } from "zod";

export const trackingModeEnum = z.enum(["SERIAL", "LOT", "QUANTITY", "LICENSE"]);
export const partnerTypeEnum = z.enum(["SUPPLIER", "CUSTOMER", "BOTH"]);

// ----- Warehouse -----
export const warehouseCreateSchema = z.object({
  code: z.string().min(1, "Bắt buộc").max(20),
  name: z.string().min(1, "Bắt buộc"),
  description: z.string().optional(),
  countsAsAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial().omit({ code: true });

// ----- Zone / Bin -----
export const zoneCreateSchema = z.object({
  warehouseId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});
export const binCreateSchema = z.object({
  zoneId: z.string().min(1),
  code: z.string().min(1),
  label: z.string().optional(),
});

// ----- Project -----
export const projectCreateSchema = z.object({
  code: z.string().min(1, "Bắt buộc"),
  name: z.string().min(1, "Bắt buộc"),
  customerId: z.string().optional().nullable(),
  customerPo: z.string().optional().nullable(),
  contractNo: z.string().optional().nullable(),
  status: z.string().default("ACTIVE"),
});
export const projectUpdateSchema = projectCreateSchema.partial().omit({ code: true });

// ----- Partner -----
export const partnerCreateSchema = z.object({
  code: z.string().min(1, "Bắt buộc"),
  name: z.string().min(1, "Bắt buộc"),
  type: partnerTypeEnum,
  taxCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email không hợp lệ").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const partnerUpdateSchema = partnerCreateSchema.partial().omit({ code: true });

// ----- Product -----
export const productCreateSchema = z.object({
  sku: z.string().min(1, "Bắt buộc"),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1, "Bắt buộc"),
  model: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  trackingMode: trackingModeEnum,
  uom: z.string().default("Cái"),
  weight: z.coerce.number().nonnegative().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  minStock: z.coerce.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const productUpdateSchema = productCreateSchema.partial().omit({ sku: true });

// ----- Inbound line: ràng buộc project/commercial -----
export const inboundLineSchema = z
  .object({
    productId: z.string().min(1),
    supplierId: z.string().min(1, "NCC bắt buộc khi nhập kho"),
    projectId: z.string().optional().nullable(),
    isCommercialStock: z.boolean().default(false),
    quantity: z.coerce.number().int().positive(),
    yearOfManufacture: z.coerce.number().int().optional().nullable(),
    originCountry: z.string().optional().nullable(),
  })
  .refine((v) => !!v.projectId || v.isCommercialStock === true, {
    message: "Phải có mã dự án HOẶC đánh dấu hàng thương mại",
    path: ["projectId"],
  });

/** Parse an toàn, ném lỗi Zod để lớp handle() bắt. */
export function parseJson<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}
