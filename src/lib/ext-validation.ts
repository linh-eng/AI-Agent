// =============================================================================
// Zod schema cho Module 5–10: Proposal · Care · Materials · Pricing · Marketing.
// =============================================================================
import { z } from "zod";

const money = z.coerce.number().optional().nullable();
const dateOpt = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

// ===== Module 5 — Treatment Proposal =====
export const proposalItemSchema = z.object({
  itemType: z.enum(["SERVICE", "TECHNOLOGY", "BRAND_PROTOCOL", "PRODUCT", "CUSTOM"]).default("SERVICE"),
  refId: z.string().optional().nullable(),
  name: z.string().min(1, "Tên hạng mục"),
  quantity: z.coerce.number().int().positive().default(1),
  sessions: z.coerce.number().int().positive().optional().nullable(),
  unitPrice: money,
  unitCost: money,
  isHomeCare: z.boolean().default(false),
  note: z.string().optional().nullable(),
  orderIndex: z.coerce.number().int().optional(),
});
export const proposalOptionSchema = z.object({
  kind: z.enum(["ESSENTIAL", "RECOMMENDED", "PREMIUM", "CUSTOM"]).default("RECOMMENDED"),
  name: z.string().min(1, "Tên phương án"),
  orderIndex: z.coerce.number().int().optional(),
  sessions: z.coerce.number().int().positive().optional().nullable(),
  estimatedDurationDays: z.coerce.number().int().positive().optional().nullable(),
  discount: money,
  note: z.string().optional().nullable(),
  items: z.array(proposalItemSchema).default([]),
});
export const proposalCreateSchema = z.object({
  customerId: z.string().min(1, "Chọn khách hàng"),
  planId: z.string().optional().nullable(),
  title: z.string().min(1, "Tiêu đề báo giá"),
  note: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  options: z.array(proposalOptionSchema).min(1, "Cần ít nhất 1 phương án"),
});
export const proposalUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  options: z.array(proposalOptionSchema).optional(), // thay thế toàn bộ (chỉ khi chưa ACCEPTED)
});
export const proposalAcceptSchema = z.object({
  optionId: z.string().min(1, "Chọn phương án khách chốt"),
  agreedPrice: money,
  appliedDiscount: money,
  acceptedBy: z.string().optional().nullable(),
});

// ===== Module 6 — Care instruction library =====
const careKind = z.enum(["PRE_CARE", "POST_CARE", "GENERAL", "FOLLOW_UP"]);
const deliveryChannel = z.enum(["IN_PERSON", "PORTAL", "EMAIL", "ZALO", "WHATSAPP", "SMS"]);

export const careInstructionCreateSchema = z.object({
  code: z.string().min(1).optional(),
  title: z.string().min(1, "Tiêu đề"),
  kind: careKind.default("PRE_CARE"),
  category: z.string().optional().nullable(),
  content: z.string().min(1, "Nội dung"),
  attachments: z.array(z.string()).default([]),
  serviceId: z.string().optional().nullable(),
  technologyId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  spaProductId: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
});
export const careInstructionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  kind: careKind.optional(),
  category: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional(),
  serviceId: z.string().optional().nullable(),
  technologyId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  spaProductId: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"]).optional(),
  bumpVersion: z.boolean().optional(),
  changeReason: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),
});
export const careInstanceCreateSchema = z.object({
  templateId: z.string().optional().nullable(),
  kind: careKind.default("PRE_CARE"),
  title: z.string().min(1),
  content: z.string().min(1),
  customerId: z.string().min(1),
  sessionId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  deliveredVia: deliveryChannel.default("IN_PERSON"),
  markDelivered: z.boolean().optional(),
  providedBy: z.string().optional().nullable(),
});
export const careInstanceUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  deliveredVia: deliveryChannel.optional(),
  markDelivered: z.boolean().optional(),
});

// ===== Module 8 — Session materials / inventory =====
export const sessionMaterialCreateSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1, "Tên vật tư"),
  spaProductId: z.string().optional().nullable(),
  inventoryProductId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  isProfessional: z.boolean().default(false),
  plannedQty: z.coerce.number().nonnegative().default(0),
  unitCost: money,
});
export const materialMoveSchema = z.object({
  type: z.enum(["REQUEST", "RESERVE", "ISSUE", "CONSUME", "RETURN", "WASTE", "DAMAGE"]),
  quantity: z.coerce.number().positive("Số lượng > 0"),
  warehouseId: z.string().optional().nullable(),
  staff: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// ===== Module 9 — Pricing =====
export const priceRuleCreateSchema = z.object({
  targetType: z.enum(["SERVICE", "PRODUCT", "TECHNOLOGY", "PACKAGE"]),
  targetId: z.string().min(1, "Chọn đối tượng áp giá"),
  targetName: z.string().optional().nullable(),
  priceType: z.enum(["STANDARD", "BRANCH", "MEMBER", "VIP", "CAMPAIGN", "CUSTOM"]).default("STANDARD"),
  branch: z.string().optional().nullable(),
  price: z.coerce.number().nonnegative(),
  effectiveFrom: dateOpt,
  effectiveTo: dateOpt,
  campaign: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  supersedesId: z.string().optional().nullable(),
});

// ===== Module 10 — Marketing =====
export const campaignCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên chiến dịch"),
  channel: z.string().optional().nullable(),
  startDate: dateOpt,
  endDate: dateOpt,
  budget: money,
  cost: money,
  targetGroup: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "ENDED"]).optional(),
  note: z.string().optional().nullable(),
});
export const campaignUpdateSchema = campaignCreateSchema.partial().omit({ code: true });
export const leadCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Tên lead"),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const leadUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "BOOKED", "WON", "LOST"]).optional(),
  note: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
});
export const leadConvertSchema = z.object({
  customerId: z.string().optional().nullable(), // gắn khách có sẵn; nếu không -> tạo mới từ lead
});
