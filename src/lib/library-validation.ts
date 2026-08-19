// =============================================================================
// Zod schema cho Thư viện Spa: Brand · Technology · Protocol · Product ·
// Product Recommendation · Form Template/Instance.
// =============================================================================
import { z } from "zod";

const jsonOpt = z.any().optional().nullable().transform((v) => v ?? undefined);
const money = z.coerce.number().nonnegative().optional().nullable();
const dateOpt = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

export const libraryStatusEnum = z.enum(["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"]);
export const protocolKindEnum = z.enum(["BRAND", "INTERNAL"]);
export const protocolCompositionModeEnum = z.enum(["LEGACY_STEPS", "SERVICES"]);

// ----- Protocol Service (Redesign P2 — compose nhiều Service, KHÔNG clone SOP) -----
export const protocolServiceSchema = z.object({
  serviceId: z.string().min(1, "Chọn dịch vụ"),
  phase: z.string().optional().nullable(),
  isRequired: z.boolean().optional().default(true),
  conditionText: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  durationOverride: z.coerce.number().int().positive().optional().nullable(),
  recommendedVariants: jsonOpt,
});
export const protocolServicesSchema = z.array(protocolServiceSchema).max(50);
export const productTypeEnum = z.enum(["PROFESSIONAL", "HOME_CARE", "BOTH"]);
export const recommendationPriorityEnum = z.enum(["ESSENTIAL", "RECOMMENDED", "OPTIONAL"]);

// ----- Brand -----
export const brandCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên brand"),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  documents: z.array(z.string()).default([]),
  note: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const brandUpdateSchema = brandCreateSchema.partial().omit({ code: true });

// ----- Technology -----
export const technologyCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên công nghệ"),
  group: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  deviceModel: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  indications: z.string().optional().nullable(),
  applicableCond: z.string().optional().nullable(),
  contraindications: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  parameters: jsonOpt,
  preCare: z.string().optional().nullable(),
  postCare: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const technologyUpdateSchema = technologyCreateSchema.partial().omit({ code: true });

// ----- Brand / Internal Protocol -----
export const brandProtocolCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên protocol"),
  kind: protocolKindEnum.default("BRAND"),
  brandId: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  suitableFor: z.string().optional().nullable(),
  contraindications: z.string().optional().nullable(),
  steps: jsonOpt,
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  parameters: jsonOpt,
  preCare: z.string().optional().nullable(),
  postCare: z.string().optional().nullable(),
  recommendedFreq: z.string().optional().nullable(),
  recommendedCount: z.coerce.number().int().positive().optional().nullable(),
  attachments: z.array(z.string()).default([]),
  note: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  technologyIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  compositionMode: protocolCompositionModeEnum.optional(),
  services: protocolServicesSchema.optional(),
});
export const brandProtocolUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  kind: protocolKindEnum.optional(),
  brandId: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  suitableFor: z.string().optional().nullable(),
  contraindications: z.string().optional().nullable(),
  steps: jsonOpt,
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  parameters: jsonOpt,
  preCare: z.string().optional().nullable(),
  postCare: z.string().optional().nullable(),
  recommendedFreq: z.string().optional().nullable(),
  recommendedCount: z.coerce.number().int().positive().optional().nullable(),
  attachments: z.array(z.string()).optional(),
  note: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
  technologyIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  // trạng thái phê duyệt & version
  status: libraryStatusEnum.optional(),
  bumpVersion: z.boolean().optional(),
  changeReason: z.string().optional().nullable(),
  changedBy: z.string().optional().nullable(),
  // Redesign P2 — chế độ compose + danh sách Service (thay toàn bộ khi gửi)
  compositionMode: protocolCompositionModeEnum.optional(),
  services: protocolServicesSchema.optional(),
});

// ----- Spa Product -----
export const spaProductCreateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1, "Tên sản phẩm"),
  brandId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  suitableFor: z.string().optional().nullable(),
  usage: z.string().optional().nullable(),
  ingredients: z.string().optional().nullable(),
  contraindications: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  volume: z.string().optional().nullable(),
  sellingPrice: money,
  cost: money,
  productType: productTypeEnum.default("HOME_CARE"),
  inventoryProductId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const spaProductUpdateSchema = spaProductCreateSchema.partial().omit({ sku: true });

// ----- Product Recommendation -----
export const recommendationCreateSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().optional().nullable(),
  spaProductId: z.string().min(1, "Chọn sản phẩm"),
  reason: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  usage: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
  price: money,
  priority: recommendationPriorityEnum.default("RECOMMENDED"),
  note: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
});
export const recommendationUpdateSchema = recommendationCreateSchema.partial().omit({ customerId: true });

// ----- Form Template -----
export const formTemplateCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên biểu mẫu"),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  schema: jsonOpt,
  createdBy: z.string().optional().nullable(),
});
export const formTemplateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  schema: jsonOpt,
  status: libraryStatusEnum.optional(),
  bumpVersion: z.boolean().optional(),
  changeReason: z.string().optional().nullable(),
  changedBy: z.string().optional().nullable(),
});

// ----- Form Instance -----
export const formInstanceCreateSchema = z.object({
  templateId: z.string().min(1),
  customerId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  data: jsonOpt,
  createdBy: z.string().optional().nullable(),
});
export const formInstanceUpdateSchema = z.object({
  name: z.string().optional().nullable(),
  data: jsonOpt,
  complete: z.boolean().optional(), // đánh dấu hoàn thành phiếu (mục 7)
});
