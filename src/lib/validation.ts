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

// ----- Inbound (M1) -----
export const inboundTypeEnum = z.enum([
  "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12",
]);

export const inboundCreateSchema = z.object({
  type: inboundTypeEnum,
  supplierId: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  destinationWarehouseId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lines: z.array(inboundLineSchema).min(1, "Phiếu nhập cần ít nhất 1 dòng"),
});

// ----- Receive (M2/M3): nhận hàng, sinh serial/lot + xuất xứ + bảo hành -----
const originInput = z.object({
  countryOfOrigin: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  coNumber: z.string().optional().nullable(),
  cqNumber: z.string().optional().nullable(),
  customsDeclarationNo: z.string().optional().nullable(),
});
const warrantyInput = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
});

const receiveSerialItem = z.object({
  serialNumber: z.string().min(1, "Thiếu serial"),
  condition: z.string().optional().nullable(),
  grade: z.enum(["A", "B", "C"]).optional().nullable(),
  binId: z.string().optional().nullable(),
  yearOfManufacture: z.coerce.number().int().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  origin: originInput.optional().nullable(),
  vendorWarranty: warrantyInput.optional().nullable(),
  thngWarranty: warrantyInput.optional().nullable(),
});

const receiveLineSchema = z
  .object({
    lineId: z.string().min(1),
    /** true = hàng lỗi -> chuyển thẳng K-HH (M2) */
    isDefective: z.boolean().default(false),
    serials: z.array(receiveSerialItem).optional(),
    lot: z
      .object({
        lotNumber: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        manufactureDate: z.string().optional().nullable(),
        expiryDate: z.string().optional().nullable(),
        origin: originInput.optional().nullable(),
        vendorWarranty: warrantyInput.optional().nullable(),
      })
      .optional(),
    quantity: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => !!v.serials?.length || !!v.lot || !!v.quantity, {
    message: "Dòng nhận cần serial, lô hoặc số lượng",
  });

export const inboundReceiveSchema = z.object({
  lines: z.array(receiveLineSchema).min(1),
});

// ----- Work Order (M4) -----
export const workOrderCreateSchema = z.object({
  mode: z.enum(["TO_ORDER", "TO_STOCK"]),
  productId: z.string().optional().nullable(), // sản phẩm thành phẩm dự kiến
  assembledBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  bomPlanned: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .default([]),
});

export const workOrderAllocateSchema = z.object({
  // Quét serial linh kiện (theo số serial) để cấp phát -> WIP
  serialNumbers: z.array(z.string().min(1)).default([]),
  // Cấp phát theo lô
  lots: z
    .array(
      z.object({
        lotId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .default([]),
});

export const workOrderQcSchema = z.object({
  result: z.enum(["PASS", "FAIL"]),
  burnInHours: z.coerce.number().int().nonnegative().optional().nullable(),
  details: z.record(z.any()).optional().nullable(),
  photos: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const workOrderCompleteSchema = z.object({
  finishedSerialNumber: z.string().min(1, "Thiếu serial thành phẩm"),
  destinationWarehouseCode: z.string().default("K-TM"),
  projectId: z.string().optional().nullable(),
  isCommercialStock: z.boolean().default(false),
  binId: z.string().optional().nullable(),
  assembledBy: z.string().optional().nullable(),
  yearOfManufacture: z.coerce.number().int().optional().nullable(),
  // Linh kiện serial thực sự lắp vào máy (con)
  consumedSerialNumbers: z.array(z.string().min(1)).default([]),
  // Lô linh kiện lắp vào máy
  consumedLots: z
    .array(
      z.object({
        lotId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .default([]),
  // License gán vào máy (cài phần mềm)
  licenseIds: z.array(z.string().min(1)).default([]),
  // Bảo hành THNG cấp cho khách (cho máy thành phẩm)
  thngWarranty: z
    .object({
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      terms: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

// ----- Kiểm kê (M5) -----
export const stockCountCreateSchema = z.object({
  warehouseId: z.string().min(1, "Chọn kho kiểm kê"),
  note: z.string().optional().nullable(),
});
export const stockCountScanSchema = z.object({
  serialNumbers: z.array(z.string().min(1)).min(1, "Chưa quét serial nào"),
});

// ----- Xuất kho (M6–M8) -----
export const outboundTypeEnum = z.enum([
  "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X10", "X11",
]);

export const outboundCreateSchema = z.object({
  type: outboundTypeEnum,
  customerId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        projectId: z.string().optional().nullable(),
      })
    )
    .min(1, "Phiếu xuất cần ít nhất 1 dòng"),
});

export const outboundRejectSchema = z.object({
  reason: z.string().min(1, "Cần lý do từ chối"),
});

export const outboundShipSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        serialNumbers: z.array(z.string().min(1)).default([]),
      })
    )
    .min(1),
  delivery: z
    .object({
      method: z.string().optional().nullable(),
      carrier: z.string().optional().nullable(),
      trackingNumber: z.string().optional().nullable(),
      signatureUrl: z.string().optional().nullable(),
      packingVideoUrl: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  /// Cho phép vượt khóa dự án K-DA (cần quyền duyệt xuất)
  allowProjectOverride: z.boolean().default(false),
});

/** Parse an toàn, ném lỗi Zod để lớp handle() bắt. */
export function parseJson<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}
