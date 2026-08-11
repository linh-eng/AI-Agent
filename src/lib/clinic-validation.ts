// =============================================================================
// Zod schema cho Module Spa / Thẩm mỹ
// (Khách hàng · CSKH · Dịch vụ · Booking · Phác đồ · Buổi thực hiện · Thanh toán · Task)
// =============================================================================
import { z } from "zod";

// ----- Enums -----
export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);
export const bookingStatusEnum = z.enum([
  "NEW",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
]);
export const crmActivityTypeEnum = z.enum([
  "CALL",
  "SMS",
  "ZALO",
  "WHATSAPP",
  "EMAIL",
  "CONSULT",
  "FEEDBACK",
  "COMPLAINT",
  "INTERNAL_NOTE",
  "FOLLOW_UP",
  "REMINDER",
  "AFTERCARE",
  "OTHER",
]);
export const planStatusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);
export const sessionStatusEnum = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export const paymentMethodEnum = z.enum(["CASH", "CARD", "TRANSFER", "EWALLET", "OTHER"]);
export const taskPriorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export const taskStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]);

// helper: coerce datetime từ string ISO / date input
const dateOpt = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));
const dateReq = z.union([z.string(), z.date()]).transform((v) => new Date(v));
const money = z.coerce.number().nonnegative().optional().nullable();
// Prisma Json không nhận `null` (chỉ Json/undefined) -> chuyển null thành undefined
const jsonOpt = z
  .record(z.any())
  .optional()
  .nullable()
  .transform((v) => v ?? undefined);

// ----- Khách hàng -----
export const customerCreateSchema = z.object({
  code: z.string().min(1).max(30).optional(), // tự sinh nếu bỏ trống
  fullName: z.string().min(1, "Bắt buộc họ tên"),
  dob: dateOpt,
  gender: genderEnum.optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  assignedTo: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  customFields: jsonOpt,
});
export const customerUpdateSchema = customerCreateSchema.partial().omit({ code: true });

// ----- CRM activity -----
export const crmActivityCreateSchema = z.object({
  customerId: z.string().min(1),
  type: crmActivityTypeEnum,
  content: z.string().min(1, "Nhập nội dung"),
  result: z.string().optional().nullable(),
  occurredAt: dateOpt,
  performedBy: z.string().optional().nullable(),
  attachments: z.array(z.string()).default([]),
  nextAction: z.string().optional().nullable(),
  followUpDate: dateOpt,
  followUpOwner: z.string().optional().nullable(),
});

// ----- Dịch vụ -----
export const serviceCategoryCreateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});
export const serviceCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Bắt buộc"),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  standardPrice: z.coerce.number().nonnegative().default(0),
  expectedCost: money,
  process: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const serviceUpdateSchema = serviceCreateSchema.partial().omit({ code: true });

// ----- Booking -----
export const bookingCreateSchema = z.object({
  code: z.string().min(1).optional(),
  customerId: z.string().min(1, "Chọn khách hàng"),
  serviceId: z.string().optional().nullable(),
  scheduledAt: dateReq,
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  branch: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  performer: z.string().optional().nullable(),
  status: bookingStatusEnum.default("NEW"),
  price: money,
  discount: money,
  deposit: money,
  campaign: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const bookingUpdateSchema = bookingCreateSchema.partial().omit({ code: true });
export const bookingStatusUpdateSchema = z.object({
  status: bookingStatusEnum,
  note: z.string().optional().nullable(),
});

// ----- Đánh giá tình trạng -----
export const assessmentCreateSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1, "Tên tình trạng"),
  area: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  indicators: jsonOpt,
  images: z.array(z.string()).default([]),
  note: z.string().optional().nullable(),
  assessedBy: z.string().optional().nullable(),
  assessedAt: dateOpt,
});

// ----- Phác đồ + giai đoạn + buổi -----
export const stageInputSchema = z.object({
  name: z.string().min(1),
  orderIndex: z.coerce.number().int().default(0),
  description: z.string().optional().nullable(),
});
export const treatmentPlanCreateSchema = z.object({
  code: z.string().min(1).optional(),
  customerId: z.string().min(1, "Chọn khách hàng"),
  name: z.string().min(1, "Tên phác đồ"),
  status: planStatusEnum.default("DRAFT"),
  goals: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  totalPrice: money,
  discount: money,
  createdBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  stages: z.array(stageInputSchema).default([]),
});
export const treatmentPlanUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  status: planStatusEnum.optional(),
  goals: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  totalPrice: money,
  discount: money,
  note: z.string().optional().nullable(),
  // tạo version mới: ghi lý do thay đổi
  bumpVersion: z.boolean().optional(),
  changeReason: z.string().optional().nullable(),
  changedBy: z.string().optional().nullable(),
});

export const sessionCreateSchema = z.object({
  planId: z.string().min(1),
  stageId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  sessionNumber: z.coerce.number().int().positive(),
  name: z.string().optional().nullable(),
  status: sessionStatusEnum.default("PLANNED"),
  scheduledAt: dateOpt,
  objective: z.string().optional().nullable(),
  plannedParams: jsonOpt,
  plannedMaterials: jsonOpt,
  plannedCost: money,
  price: money,
  preCare: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const sessionUpdateSchema = z.object({
  stageId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  status: sessionStatusEnum.optional(),
  scheduledAt: dateOpt,
  performedAt: dateOpt,
  performer: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  plannedParams: jsonOpt,
  actualParams: jsonOpt,
  plannedMaterials: jsonOpt,
  actualMaterials: jsonOpt,
  conditionBefore: z.string().optional().nullable(),
  conditionAfter: z.string().optional().nullable(),
  beforeImages: z.array(z.string()).optional(),
  afterImages: z.array(z.string()).optional(),
  customerFeedback: z.string().optional().nullable(),
  preCare: z.string().optional().nullable(),
  postCare: z.string().optional().nullable(),
  plannedCost: money,
  actualCost: money,
  price: money,
  note: z.string().optional().nullable(),
  checkedBy: z.string().optional().nullable(),
});

// ----- Thanh toán -----
export const paymentCreateSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Số tiền phải > 0"),
  method: paymentMethodEnum.default("CASH"),
  paidAt: dateOpt,
  receivedBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// ----- Task -----
export const taskCreateSchema = z.object({
  title: z.string().min(1, "Nhập nội dung"),
  description: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  assignee: z.string().optional().nullable(),
  dueDate: dateOpt,
  priority: taskPriorityEnum.default("NORMAL"),
  status: taskStatusEnum.default("OPEN"),
  createdBy: z.string().optional().nullable(),
});
export const taskUpdateSchema = taskCreateSchema.partial();
