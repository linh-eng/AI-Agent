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
export const planStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
]);
export const stageStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export const frequencyUnitEnum = z.enum(["DAY", "WEEK", "MONTH"]);
export const sessionStatusEnum = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED"]);
export const paymentMethodEnum = z.enum(["CASH", "CARD", "TRANSFER", "EWALLET", "OTHER"]);
export const taskPriorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export const taskStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]);

// helper: coerce datetime từ string ISO / date input
// Giữ `undefined` khi client KHÔNG gửi field (Prisma bỏ qua → không ghi đè),
// chỉ set `null` khi client gửi null tường minh (xóa giá trị). Tránh bug PATCH
// một phần vô tình xóa cột ngày không kèm theo.
const dateOpt = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v ? new Date(v) : null));
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
  legacyId: z.string().max(120).optional().nullable(), // đối chiếu import từ hệ thống cũ
  legacySource: z.string().max(60).optional().nullable(),
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
  code: z.string().min(1).optional(), // tự sinh nếu bỏ trống (tạo nhanh trong form)
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const serviceCategoryUpdateSchema = serviceCategoryCreateSchema.partial().omit({ code: true });

export const serviceStatusEnum = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
const staffRequirementSchema = z.array(
  z.object({ role: z.string().min(1), quantity: z.coerce.number().int().min(0).default(1), required: z.boolean().default(false) })
);
const resourceReqOne = z.object({ required: z.boolean().default(false), default: z.string().optional().nullable() });
const resourceRequirementSchema = z.object({
  room: resourceReqOne.optional(),
  bed: resourceReqOne.optional(),
  machine: resourceReqOne.optional(),
});
export const serviceMaterialStandardSchema = z.array(
  z.object({
    name: z.string().min(1),
    quantity: z.coerce.number().nonnegative().default(1),
    unit: z.string().min(1),
    note: z.string().optional().nullable(),
    required: z.boolean().default(false),
    spaProductId: z.string().optional().nullable(),
    usageMaterialId: z.string().optional().nullable(),
  })
);
export const serviceCreateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1, "Bắt buộc"),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: serviceStatusEnum.default("ACTIVE"),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  machineMinutes: z.coerce.number().int().positive().optional().nullable(),
  roomMinutes: z.coerce.number().int().positive().optional().nullable(),
  standardPrice: z.coerce.number().nonnegative().default(0),
  expectedCost: money,
  process: z.string().optional().nullable(),
  technologyIds: z.array(z.string()).optional(),
  protocolIds: z.array(z.string()).optional(),
  defaultTechnologyId: z.string().optional().nullable(),
  defaultProtocolId: z.string().optional().nullable(),
  staffRequirements: staffRequirementSchema.optional(),
  resourceRequirements: resourceRequirementSchema.optional(),
  materials: serviceMaterialStandardSchema.optional(),
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
  bed: z.string().optional().nullable(),
  machine: z.string().optional().nullable(),
  technician: z.string().optional().nullable(),
  master: z.string().optional().nullable(),
  assistants: z.array(z.string()).optional(),
  performer: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  sessionNumber: z.coerce.number().int().positive().optional().nullable(),
  sessionId: z.string().optional().nullable(), // gắn ngược buổi dự kiến (mục 11–12) — không phải cột Booking
  status: bookingStatusEnum.default("NEW"),
  price: money,
  discount: money,
  deposit: money,
  campaign: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  allowConflict: z.boolean().optional(), // cho phép đặt dù trùng lịch (không lưu DB)
  overrideReason: z.string().optional().nullable(), // lý do đặt đè khi trùng (bắt buộc khi allowConflict)
  allowBelowFloor: z.boolean().optional(), // cho phép bán dưới giá sàn (cần quyền override)
});
export const bookingUpdateSchema = bookingCreateSchema.partial().omit({ code: true });
export const bookingStatusUpdateSchema = z.object({
  status: bookingStatusEnum,
  note: z.string().optional().nullable(),
  reason: z.string().optional().nullable(), // lý do (hủy / không đến)
});
// Đổi lịch — giữ lịch cũ, ghi lịch sử.
export const bookingRescheduleSchema = z.object({
  scheduledAt: dateReq,
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  technician: z.string().optional().nullable(),
  master: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  bed: z.string().optional().nullable(),
  machine: z.string().optional().nullable(),
  reason: z.string().min(1, "Nhập lý do đổi lịch"),
  allowConflict: z.boolean().optional(),
  overrideReason: z.string().optional().nullable(),
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
  id: z.string().optional(), // dùng khi cập nhật giai đoạn có sẵn
  name: z.string().min(1),
  orderIndex: z.coerce.number().int().default(0),
  description: z.string().optional().nullable(), // mục tiêu giai đoạn
  status: stageStatusEnum.optional(),
  plannedStartDate: dateOpt,
  plannedEndDate: dateOpt,
  plannedSessions: z.coerce.number().int().nonnegative().optional().nullable(),
  frequencyValue: z.coerce.number().int().positive().optional().nullable(),
  frequencyUnit: frequencyUnitEnum.optional().nullable(),
  note: z.string().optional().nullable(),
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
  plannedStartDate: dateOpt,
  plannedEndDate: dateOpt,
  designer: z.string().optional().nullable(),
  approver: z.string().optional().nullable(),
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
  plannedStartDate: dateOpt,
  plannedEndDate: dateOpt,
  designer: z.string().optional().nullable(),
  approver: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  // tạo version mới: ghi lý do thay đổi (giữ tương thích với đường cũ)
  bumpVersion: z.boolean().optional(),
  changeReason: z.string().optional().nullable(),
  changedBy: z.string().optional().nullable(),
});
// Tạo version mới (mục 16–17): lý do bắt buộc, tùy chọn clone cấu trúc giai đoạn/buổi tương lai
export const planVersionCreateSchema = z.object({
  reason: z.string().min(1, "Nhập lý do thay đổi"),
  summary: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
});
// Cập nhật 1 giai đoạn (mục 5) — endpoint /api/treatment-stages/[id]
export const stageUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  orderIndex: z.coerce.number().int().optional(),
  description: z.string().optional().nullable(),
  status: stageStatusEnum.optional(),
  plannedStartDate: dateOpt,
  plannedEndDate: dateOpt,
  plannedSessions: z.coerce.number().int().nonnegative().optional().nullable(),
  frequencyValue: z.coerce.number().int().positive().optional().nullable(),
  frequencyUnit: frequencyUnitEnum.optional().nullable(),
  note: z.string().optional().nullable(),
});
// Thêm 1 giai đoạn vào phác đồ có sẵn — endpoint POST /api/treatment-stages
export const stageCreateSchema = stageInputSchema.extend({
  planId: z.string().min(1),
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
  technologyId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  orderIndex: z.coerce.number().int().optional(),
  steps: jsonOpt,
  professionalProducts: jsonOpt,
  plannedParams: jsonOpt,
  plannedMaterials: jsonOpt,
  plannedCost: money,
  price: money,
  preCare: z.string().optional().nullable(),
  postCare: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  // --- Kế hoạch riêng cho buổi (mục 8, 14) ---
  plannedServiceId: z.string().optional().nullable(),
  plannedTechnologyId: z.string().optional().nullable(),
  plannedProtocolId: z.string().optional().nullable(),
  plannedStaff: z.any().optional().nullable(),
  plannedDate: dateOpt,
  intervalDays: z.coerce.number().int().nonnegative().optional().nullable(),
});
export const sessionUpdateSchema = z.object({
  stageId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  technologyId: z.string().optional().nullable(),
  brandProtocolId: z.string().optional().nullable(),
  orderIndex: z.coerce.number().int().optional(),
  steps: jsonOpt,
  professionalProducts: jsonOpt,
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
  // --- Kế hoạch riêng cho buổi (chỉ sửa khi thiết kế kế hoạch, KHÔNG dùng lúc ghi nhận thực tế) ---
  plannedServiceId: z.string().optional().nullable(),
  plannedTechnologyId: z.string().optional().nullable(),
  plannedProtocolId: z.string().optional().nullable(),
  plannedStaff: z.any().optional().nullable(),
  plannedDate: dateOpt,
  intervalDays: z.coerce.number().int().nonnegative().optional().nullable(),
  // --- SESSION = LẦN THỰC HIỆN (mục 5) ---
  // B — Trước khi thực hiện
  prevReaction: z.string().optional().nullable(),
  todayWish: z.string().optional().nullable(),
  contraindications: z.string().optional().nullable(),
  warnings: z.string().optional().nullable(),
  currentMeds: z.string().optional().nullable(),
  // C — Thực hiện thực tế
  actualStartAt: dateOpt,
  actualEndAt: dateOpt,
  treatmentArea: z.string().optional().nullable(),
  // F — Sau khi thực hiện
  incident: z.string().optional().nullable(),
  handledAction: z.string().optional().nullable(),
  nextSuggestion: z.string().optional().nullable(),
  followUpDate: dateOpt,
  // Sửa sau khi hoàn thành (mục 29): lý do bắt buộc khi Session đã COMPLETED
  editReason: z.string().optional().nullable(),
});
// Tạo lịch hẹn từ 1 buổi dự kiến (mục 11) — trả về payload prefill cho form Lịch hẹn
export const sessionToBookingSchema = z.object({
  bookingId: z.string().min(1), // booking vừa tạo ở module Lịch hẹn → gắn ngược vào buổi
});

// ----- Thanh toán -----
export const paymentCreateSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Số tiền phải > 0"),
  method: paymentMethodEnum.default("CASH"),
  paidAt: dateOpt,
  receivedBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// ----- Hóa đơn (mục 14–18) -----
export const invoiceStatusEnum = z.enum(["UNPAID", "PARTIAL", "PAID", "CANCELLED"]);

export const invoiceItemInputSchema = z.object({
  name: z.string().min(1, "Nhập tên hạng mục"),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  note: z.string().optional().nullable(),
});

// Tạo hóa đơn: hoặc từ báo giá đã chốt (proposalId), hoặc lập thủ công (items).
export const invoiceCreateSchema = z
  .object({
    customerId: z.string().optional().nullable(),
    proposalId: z.string().optional().nullable(),
    planId: z.string().optional().nullable(),
    items: z.array(invoiceItemInputSchema).optional(),
    discount: z.coerce.number().min(0).default(0),
    dueDate: dateOpt,
    note: z.string().optional().nullable(),
  })
  .refine((v) => v.proposalId || (v.customerId && v.items && v.items.length > 0), {
    message: "Cần proposalId (từ báo giá) hoặc customerId kèm hạng mục",
  });

export const invoiceUpdateSchema = z.object({
  status: invoiceStatusEnum.optional(), // dùng để hủy (CANCELLED)
  dueDate: dateOpt,
  note: z.string().optional().nullable(),
});

// ----- Nhân sự (mục 22–24) -----
export const sessionStaffRoleEnum = z.enum(["PRIMARY", "ASSISTANT", "MASTER", "CHECKER", "CONSULTANT"]);

export const employeeCreateSchema = z.object({
  code: z.string().min(1).max(30).optional(), // tự sinh nếu bỏ trống
  fullName: z.string().min(1, "Bắt buộc họ tên"),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  roles: z.array(z.string()).default([]), // đa vai trò
  defaultFee: z.coerce.number().min(0).optional().nullable(),
  note: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ code: true });

export const sessionStaffCreateSchema = z.object({
  sessionId: z.string().min(1),
  employeeId: z.string().optional().nullable(),
  staffName: z.string().min(1, "Chọn/nhập nhân sự"),
  role: sessionStaffRoleEnum.default("PRIMARY"),
  fee: z.coerce.number().min(0).optional().nullable(),
  note: z.string().optional().nullable(),
});

// ----- Quản trị người dùng (đăng nhập + vai trò) -----
export const userCreateSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Nhập họ tên"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  roleCodes: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});
export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").optional().or(z.literal("")),
  roleCodes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ----- Import khách hàng (mục 41) -----
export const importCustomerRowSchema = z.object({
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  legacyId: z.string().optional().nullable(),
});
export const importCustomersSchema = z.object({
  legacySource: z.string().max(60).default("MySpa"),
  rows: z.array(importCustomerRowSchema).min(1, "Không có dòng nào").max(5000, "Tối đa 5000 dòng/lần"),
});

// ----- Đánh giá sau buổi (mục 36–37) -----
export const sessionReviewUpsertSchema = z.object({
  sessionId: z.string().min(1),
  satisfactionScore: z.coerce.number().int().min(1).max(5).optional().nullable(),
  technicianScore: z.coerce.number().int().min(1).max(5).optional().nullable(),
  technicianName: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  wouldReturn: z.boolean().optional().nullable(),
  technicianReport: z.string().optional().nullable(),
});

// ----- CSKH follow-up (mục 31–35) -----
export const deliveryChannelEnum = z.enum(["IN_PERSON", "PORTAL", "EMAIL", "ZALO", "WHATSAPP", "SMS"]);
export const followUpTriggerEnum = z.enum(["AFTER_SERVICE", "AFTER_SESSION", "BIRTHDAY", "MANUAL"]);

export const followUpStepSchema = z.object({
  orderIndex: z.coerce.number().int().default(0),
  dayOffset: z.coerce.number().int().default(0),
  channel: deliveryChannelEnum.default("IN_PERSON"),
  title: z.string().min(1, "Nhập việc cần làm"),
  script: z.string().optional().nullable(),
  checklist: z.array(z.string()).default([]),
});

export const followUpTemplateCreateSchema = z.object({
  name: z.string().min(1, "Nhập tên quy trình"),
  description: z.string().optional().nullable(),
  trigger: followUpTriggerEnum.default("MANUAL"),
  isActive: z.boolean().optional(),
  steps: z.array(followUpStepSchema).default([]),
});
export const followUpTemplateUpdateSchema = followUpTemplateCreateSchema.partial();

export const followUpApplySchema = z.object({
  customerId: z.string().min(1, "Chọn khách hàng"),
  anchorDate: dateOpt, // mốc tính (mặc định hôm nay)
  assignee: z.string().optional().nullable(),
});

// ----- Giá sàn (mục 25–26) -----
export const priceFloorUpsertSchema = z.object({
  serviceId: z.string().min(1),
  laborCost: z.coerce.number().min(0).default(0),
  operationCost: z.coerce.number().min(0).default(0),
  depreciationCost: z.coerce.number().min(0).default(0),
  materialCost: z.coerce.number().min(0).default(0),
  roomCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  minMarginPercent: z.coerce.number().min(0).max(1000).default(0),
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

// Sắp xếp lại thứ tự buổi (kéo–thả)
export const sessionReorderSchema = z.object({
  order: z.array(z.object({ id: z.string().min(1), orderIndex: z.coerce.number().int() })).min(1),
});
