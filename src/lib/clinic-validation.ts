// =============================================================================
// Zod schema cho Module Spa / Thẩm mỹ
// (Khách hàng · CSKH · Dịch vụ · Booking · Phác đồ · Buổi thực hiện · Thanh toán · Task)
// =============================================================================
import { z } from "zod";
import { parseVnLocal } from "./timezone";

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
// Nhận input datetime-local (giờ VN) lưu wall-clock ổn định bất kể TZ tiến trình
// (xem `src/lib/timezone.ts`). date-only & chuỗi có múi giờ vẫn xử lý như cũ.
const dateOpt = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v ? parseVnLocal(v) : null));
const dateReq = z.union([z.string(), z.date()]).transform((v) => parseVnLocal(v));
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

// ----- SOP chuẩn hóa: ServiceStep + Product/Technology/Option (Redesign P1) -----
const stepProductSchema = z.object({
  spaProductId: z.string().optional().nullable(),
  name: z.string().min(1, "Nhập tên vật tư"),
  quantity: z.coerce.number().positive("Định mức phải > 0"),
  unit: z.string().min(1, "Nhập đơn vị"),
  isRequired: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});
const stepTechnologySchema = z.object({
  technologyId: z.string().min(1),
  suggestedParameters: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
});
const stepOptionSchema = z.object({
  name: z.string().min(1, "Nhập tên phương án"),
  selectMode: z.enum(["SINGLE_SELECT", "OPTIONAL"]).default("SINGLE_SELECT"),
  isDefault: z.boolean().default(false),
  spaProductId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive().optional().nullable(),
  unit: z.string().optional().nullable(),
  technique: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  conditionText: z.string().optional().nullable(),
});
export const serviceStepSchema = z.object({
  name: z.string().min(1, "Nhập tên bước"),
  description: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  technique: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  warnings: z.string().optional().nullable(),
  isRequired: z.boolean().default(true),
  conditionText: z.string().optional().nullable(),
  products: z.array(stepProductSchema).default([]),
  technologies: z.array(stepTechnologySchema).default([]),
  options: z.array(stepOptionSchema).default([]),
});
export const serviceStepsSchema = z.array(serviceStepSchema);

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
  steps: serviceStepsSchema.optional(), // SOP chuẩn hóa (Redesign P1)
});
export const serviceUpdateSchema = serviceCreateSchema.partial().omit({ code: true });

// ----- Booking -----
// Redesign P3 — hạng mục dịch vụ trong 1 booking (nhiều dịch vụ tuần tự).
export const bookingItemSchema = z.object({
  serviceId: z.string().min(1, "Chọn dịch vụ"),
  durationSnapshot: z.coerce.number().int().positive().optional().nullable(),
  priceSnapshot: money,
  plannedSessionId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const bookingItemsSchema = z.array(bookingItemSchema).max(20);

export const bookingCreateSchema = z.object({
  code: z.string().min(1).optional(),
  customerId: z.string().min(1, "Chọn khách hàng"),
  serviceId: z.string().optional().nullable(),
  items: bookingItemsSchema.optional(), // Redesign P3 — nhiều dịch vụ; item[0] = dịch vụ chính
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
  // Redesign P4 (Decision 1) — planId TÙY CHỌN: walk-in/dịch vụ lẻ không cần phác đồ.
  // Khi không có planId thì phải có customerId (hoặc bookingId để suy ra khách).
  planId: z.string().min(1).optional().nullable(),
  customerId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  sessionNumber: z.coerce.number().int().positive().optional().default(1),
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

// --- Redesign P4 — Actual execution items ---
export const executionOptionSourceEnum = z.enum(["SERVICE_SOP_OPTION", "PROTOCOL_VARIANT", "PRACTITIONER_ADHOC"]);
export const actualValueSchema = z.object({
  stepName: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  qtyStd: z.coerce.number().optional().nullable(),
  qtyActual: z.coerce.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const sessionExecutionCreateSchema = z.object({
  sessionId: z.string().min(1),
  serviceId: z.string().min(1, "Chọn dịch vụ thực hiện"),
  bookingItemId: z.string().optional().nullable(),
  selectedOptionSource: executionOptionSourceEnum.default("PRACTITIONER_ADHOC"),
  selectedOptionId: z.string().optional().nullable(),
  selectedOptionName: z.string().optional().nullable(),
  actualValues: z.array(actualValueSchema).optional(),
  instructions: z.string().optional().nullable(),
  actualStartAt: dateOpt,
  actualEndAt: dateOpt,
  note: z.string().optional().nullable(),
});
export const sessionExecutionUpdateSchema = z.object({
  selectedOptionSource: executionOptionSourceEnum.optional(),
  selectedOptionId: z.string().optional().nullable(),
  selectedOptionName: z.string().optional().nullable(),
  actualValues: z.array(actualValueSchema).optional(),
  instructions: z.string().optional().nullable(),
  actualStartAt: dateOpt,
  actualEndAt: dateOpt,
  note: z.string().optional().nullable(),
  reason: z.string().optional().nullable(), // bắt buộc khi sửa sau completed (kiểm ở route)
});

// --- Redesign P4 — material usage idempotency + reversal ---
export const materialUsageReverseSchema = z.object({
  reason: z.string().min(1, "Nhập lý do hoàn tác"),
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
  txnRef: z.string().optional().nullable(),
  paidAt: dateOpt,
  receivedBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// Hủy phiếu thu (mục 16) — bắt buộc lý do, không hard-delete.
export const paymentVoidSchema = z.object({
  reason: z.string().min(1, "Nhập lý do hủy phiếu thu"),
});

// ----- Tiền cọc (mục 17) -----
export const depositCreateSchema = z.object({
  customerId: z.string().min(1),
  bookingId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Số tiền cọc phải > 0"),
  method: paymentMethodEnum.default("CASH"),
  txnRef: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const depositAllocateSchema = z.object({
  invoiceId: z.string().min(1, "Chọn hóa đơn để phân bổ cọc"),
});

export const depositVoidSchema = z.object({
  reason: z.string().min(1, "Nhập lý do hủy phiếu cọc"),
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

export const employeeStatusEnum = z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED"]);

export const employeeCreateSchema = z.object({
  code: z.string().min(1).max(30).optional(), // tự sinh nếu bỏ trống
  fullName: z.string().min(1, "Bắt buộc họ tên"),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  dob: dateOpt,
  title: z.string().optional().nullable(),
  branch: z.string().optional().nullable(), // LEGACY String — giữ
  startDate: dateOpt,
  status: employeeStatusEnum.optional(),
  roles: z.array(z.string()).default([]), // đa vai trò
  defaultFee: z.coerce.number().min(0).optional().nullable(),
  note: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  // --- HR-PH1 (additive) ---
  branchId: z.string().optional().nullable(), // chọn Branch chuẩn hóa
  employmentType: z.enum(["MONTHLY", "DAILY", "HOURLY", "CONTRACT", "OTHER"]).optional().nullable(),
  endDate: dateOpt,
});
export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ code: true });

// HR-PH1 — liên kết/gỡ tài khoản đăng nhập ↔ hồ sơ nhân sự (chỉ theo FK userId).
export const employeeLinkUserSchema = z.object({
  userId: z.string().min(1).nullable(), // null = gỡ liên kết
});

// HR-PH1 — Danh mục chi nhánh (master).
export const branchCreateSchema = z.object({
  code: z.string().min(1).max(30).optional(), // tự sinh CN-xxxx nếu trống
  name: z.string().min(1, "Bắt buộc tên chi nhánh"),
  timezone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export const branchUpdateSchema = branchCreateSchema.partial();

// ----- Nhân sự master data (mục 8) -----
export const roleFeeCreateSchema = z.object({
  role: z.string().min(1, "Chọn vai trò"),
  fee: z.coerce.number().min(0).default(0),
  effectiveFrom: dateOpt,
  effectiveTo: dateOpt,
  note: z.string().optional().nullable(),
});
export const competenceCreateSchema = z.object({
  kind: z.enum(["TECHNOLOGY", "SERVICE", "PROTOCOL", "ROLE"]),
  refId: z.string().optional().nullable(),
  name: z.string().min(1, "Nhập tên năng lực"),
  note: z.string().optional().nullable(),
});
export const certificationCreateSchema = z.object({
  name: z.string().min(1, "Nhập tên chứng nhận"),
  issuer: z.string().optional().nullable(),
  issuedAt: dateOpt,
  expiresAt: dateOpt,
  mediaId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const scheduleCreateSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  shift: z.string().optional().nullable(),
  effectiveFrom: dateOpt,
  effectiveTo: dateOpt,
});
export const leaveCreateSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "EMERGENCY", "UNAVAILABLE", "OTHER"]).default("ANNUAL"),
  fromAt: dateReq,
  toAt: dateReq,
  reason: z.string().optional().nullable(),
});

// ===== HR-PH2 — Ca dated + Chấm công + Nghỉ phép (đơn duyệt) =====
const leaveTypeEnum = z.enum(["ANNUAL", "SICK", "EMERGENCY", "UNAVAILABLE", "OTHER"]);
const attSourceEnum = z.enum(["APP", "MANUAL", "DEVICE"]);

// Ca tạo tay (quản lý): thời gian nhận CHUỖI (giờ VN) → route parse bằng parseVnLocal.
export const workShiftCreateSchema = z.object({
  employeeId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  scheduledStartAt: z.string().min(1),
  scheduledEndAt: z.string().min(1),
  breakMinutes: z.coerce.number().int().min(0).optional(),
  shiftLabel: z.string().optional().nullable(),
  roleSnapshot: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const workShiftUpdateSchema = z.object({
  scheduledStartAt: z.string().optional(),
  scheduledEndAt: z.string().optional(),
  breakMinutes: z.coerce.number().int().min(0).optional(),
  shiftLabel: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  note: z.string().optional().nullable(),
});
export const workShiftGenerateSchema = z.object({
  employeeId: z.string().min(1),
  from: z.string().min(1), // "YYYY-MM-DD"
  to: z.string().min(1),
  branchId: z.string().optional().nullable(),
});

// Check-in: self (employeeId bỏ trống → lấy từ phiên) hoặc quản lý chỉ định.
export const attendanceCheckInSchema = z.object({
  employeeId: z.string().optional().nullable(),
  workShiftId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  at: z.string().optional().nullable(), // MANUAL: quản lý nhập giờ; bỏ trống = server now()
  source: attSourceEnum.optional(),
  note: z.string().optional().nullable(),
});
export const attendanceCheckOutSchema = z.object({
  attendanceId: z.string().optional().nullable(), // bỏ trống = bản OPEN của chính mình
  employeeId: z.string().optional().nullable(), // quản lý check-out hộ
  at: z.string().optional().nullable(),
  breakMinutesActual: z.coerce.number().int().min(0).optional(),
});
// Quản lý tạo bản chấm công thủ công (bù ngày công / sửa).
export const attendanceManualSchema = z.object({
  employeeId: z.string().min(1),
  workShiftId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  checkInAt: z.string().min(1),
  checkOutAt: z.string().optional().nullable(),
  breakMinutesActual: z.coerce.number().int().min(0).optional(),
  note: z.string().optional().nullable(),
});
// Điều chỉnh chấm công (append-only). requested=true → đề nghị của nhân viên (không tự duyệt).
export const attendanceAdjustmentSchema = z.object({
  reason: z.string().min(1, "Bắt buộc lý do"),
  requested: z.boolean().optional(), // true = nhân viên đề nghị; false/absent = quản lý áp dụng
  checkInAt: z.string().optional().nullable(),
  checkOutAt: z.string().optional().nullable(),
  breakMinutesActual: z.coerce.number().int().min(0).optional(),
  branchId: z.string().optional().nullable(),
});
export const attendanceVoidSchema = z.object({ reason: z.string().min(1, "Bắt buộc lý do") });

// Đơn nghỉ có duyệt (dùng chung bảng EmployeeLeave; status lifecycle).
export const leaveRequestCreateSchema = z.object({
  employeeId: z.string().optional().nullable(), // self → từ phiên
  type: leaveTypeEnum.default("ANNUAL"),
  fromAt: dateReq,
  toAt: dateReq,
  isPaid: z.boolean().optional(),
  reason: z.string().optional().nullable(),
  autoApprove: z.boolean().optional(), // quản lý tạo trực tiếp đã duyệt
});
export const leaveDecisionSchema = z.object({ reason: z.string().optional().nullable() });

// ===== HR-PH3 — Sổ đóng góp nhân sự theo buổi =====
export const contributionCreateSchema = z.object({
  treatmentSessionId: z.string().min(1),
  sessionExecutionItemId: z.string().optional().nullable(),
  serviceStepKey: z.string().optional().nullable(),
  employeeId: z.string().min(1),
  contributionTypeCode: z.string().min(1, "Chọn loại đóng góp"),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  actualMinutes: z.coerce.number().int().min(0).optional().nullable(),
  weight: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  branchId: z.string().optional().nullable(),
  source: z.enum(["APP", "MANUAL", "DEVICE"]).optional(),
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});
export const contributionUpdateSchema = z.object({
  contributionTypeCode: z.string().optional(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  actualMinutes: z.coerce.number().int().min(0).optional().nullable(),
  weight: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  branchId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export const contributionReverseSchema = z.object({ reason: z.string().min(1, "Bắt buộc lý do") });

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
  strategy: z.enum(["skip", "update"]).default("skip"), // xử lý dòng trùng (mục 12)
  filename: z.string().max(260).optional().nullable(),
  mapping: z.record(z.any()).optional().nullable(), // snapshot cột nguồn → trường chuẩn
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
  force: z.boolean().optional(), // true = xác nhận tạo dù đã có lần áp trùng (mục 9)
  note: z.string().optional().nullable(),
});

// Hủy một LẦN ÁP quy trình (khác "ngưng dùng" mẫu) — lý do bắt buộc (mục 9).
export const careInstanceCancelSchema = z.object({
  reason: z.string().min(1, "Nhập lý do hủy lần áp"),
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

// ----- Giá sàn v2 (mục 7): cost breakdown theo dòng + version -----
export const costCategoryEnum = z.enum(["MATERIAL", "STAFF", "MACHINE", "ROOM", "OPERATION", "OTHER"]);
export const costCalcTypeEnum = z.enum(["FIXED", "PER_MINUTE", "PER_SESSION", "PER_USE", "PERCENT_DIRECT", "PER_DURATION"]);
export const floorMethodEnum = z.enum(["MARGIN", "MARKUP", "MANUAL"]);

export const floorCostLineSchema = z.object({
  category: costCategoryEnum,
  name: z.string().min(1, "Nhập tên dòng chi phí"),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().optional().nullable(),
  unitCost: z.coerce.number().min(0).default(0),
  calcType: costCalcTypeEnum.default("FIXED"),
  calcValue: z.coerce.number().min(0).optional().nullable(),
  minutes: z.coerce.number().int().min(0).optional().nullable(),
  refId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  required: z.boolean().default(true),
  note: z.string().optional().nullable(),
});

// Tạo version mới (nếu không gửi lines → tự dựng từ định mức dịch vụ).
export const floorVersionCreateSchema = z.object({
  serviceId: z.string().min(1),
  method: floorMethodEnum.default("MARGIN"),
  minMarginPercent: z.coerce.number().min(0).max(99.99).default(0),
  manualFloorPrice: z.coerce.number().min(0).optional().nullable(),
  roundingUnit: z.coerce.number().int().min(1).default(1000),
  changeReason: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lines: z.array(floorCostLineSchema).optional(), // bỏ trống → auto từ dịch vụ
});

// PH2 — Tạo Floor version từ ServiceCostingVersion đã PHÁT HÀNH.
//   minMarginPercent: 0 ≤ rate < 100 (max 99.99 → ≥100% trả 422; âm trả 422).
export const floorVersionFromCostingSchema = z.object({
  serviceCostingVersionId: z.string().min(1),
  minMarginPercent: z.coerce.number().min(0).max(99.99),
  roundingUnit: z.coerce.number().int().min(1).default(1000),
  changeReason: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// Sửa version DRAFT/PENDING (thay toàn bộ lines).
export const floorVersionUpdateSchema = z.object({
  method: floorMethodEnum.optional(),
  minMarginPercent: z.coerce.number().min(0).max(99.99).optional(),
  manualFloorPrice: z.coerce.number().min(0).optional().nullable(),
  roundingUnit: z.coerce.number().int().min(1).optional(),
  effectiveFrom: dateOpt,
  effectiveTo: dateOpt,
  changeReason: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lines: z.array(floorCostLineSchema).optional(),
});

// Chuyển trạng thái version: submit | approve | activate | cancel.
export const floorVersionStatusSchema = z.object({
  action: z.enum(["submit", "approve", "activate", "cancel"]),
  effectiveFrom: dateOpt,
  effectiveTo: dateOpt,
  reason: z.string().optional().nullable(),
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

// Vòng đời task CSKH (mục 9) — hành động có audit, KHÔNG hard-delete lịch sử.
// action: start (→IN_PROGRESS) | complete (→DONE) | reopen (DONE→OPEN) | cancel (→CANCELLED)
//         | update (sửa hạn/phụ trách/nội dung/kênh → ghi audit thay đổi)
export const taskActionSchema = z.object({
  action: z.enum(["start", "complete", "reopen", "cancel", "update"]),
  // complete:
  completionNote: z.string().optional().nullable(),
  checklistState: z.array(z.boolean()).optional().nullable(), // các mục đã tick (theo thứ tự checklist)
  actualChannel: deliveryChannelEnum.optional().nullable(),
  // reopen/cancel: lý do bắt buộc (kiểm ở route)
  reason: z.string().optional().nullable(),
  // update: các trường được phép sửa (mỗi thay đổi ghi audit)
  assignee: z.string().optional().nullable(),
  dueDate: dateOpt,
  priority: taskPriorityEnum.optional(),
  channel: deliveryChannelEnum.optional().nullable(),
  description: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
});

// Sắp xếp lại thứ tự buổi (kéo–thả)
export const sessionReorderSchema = z.object({
  order: z.array(z.object({ id: z.string().min(1), orderIndex: z.coerce.number().int() })).min(1),
});

// =============================================================================
// PRICING / COSTING — PH1: Service Costing (giá vốn dịch vụ có version).
//  * override vật tư phải KÈM lý do (refine → 422 nếu thiếu).
//  * PH1 chỉ tính COST — không có Floor/Recommended trong schema này.
// =============================================================================
const overheadMethodEnum = z.enum(["MANUAL", "FIXED_PER_SERVICE", "PER_MINUTE"]);

const costingBase = z.object({
  materialOverride: z.coerce.number().min(0).optional().nullable(),
  materialOverrideReason: z.string().trim().min(1).optional().nullable(),
  equipmentCost: z.coerce.number().min(0).optional(),
  facilityCost: z.coerce.number().min(0).optional(),
  otherCost: z.coerce.number().min(0).optional(),
  overheadMethod: overheadMethodEnum.optional(),
  overheadValue: z.coerce.number().min(0).optional(),
  durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  note: z.string().optional().nullable(),
});

// override có giá trị (≠ null) thì lý do bắt buộc.
const requireOverrideReason = (d: { materialOverride?: number | null; materialOverrideReason?: string | null }) =>
  d.materialOverride == null || !!(d.materialOverrideReason && d.materialOverrideReason.trim());

export const costingCreateSchema = costingBase
  .extend({ serviceId: z.string().min(1) })
  .refine(requireOverrideReason, { message: "Ghi đè giá vốn vật tư cần lý do", path: ["materialOverrideReason"] });

export const costingUpdateSchema = costingBase
  .partial()
  .refine(requireOverrideReason, { message: "Ghi đè giá vốn vật tư cần lý do", path: ["materialOverrideReason"] });

export const costingPublishSchema = z.object({ note: z.string().optional().nullable() });

// =============================================================================
// PRICING / COSTING — PH3: Recommended Price (giá đề xuất theo biên mục tiêu).
//   targetMarginPercent: 0 ≤ % < 100 (âm/≥100 → 422). Nguồn = ServiceCostingVersion PUBLISHED.
// =============================================================================
export const recommendedCreateSchema = z.object({
  serviceId: z.string().min(1),
  serviceCostingVersionId: z.string().min(1),
  targetMarginPercent: z.coerce.number().min(0).max(99.99),
  roundingUnit: z.coerce.number().int().min(1).default(1000),
  note: z.string().optional().nullable(),
});

export const recommendedUpdateSchema = z.object({
  targetMarginPercent: z.coerce.number().min(0).max(99.99).optional(),
  roundingUnit: z.coerce.number().int().min(1).optional(),
  note: z.string().optional().nullable(),
});

// =============================================================================
// PRICING / COSTING — PH5: Protocol / Package pricing.
// =============================================================================
export const protocolCostingCreateSchema = z.object({
  protocolId: z.string().min(1),
  packageSpecificCost: z.coerce.number().min(0).optional(),
  packageSpecificReason: z.string().trim().min(1).optional().nullable(),
  note: z.string().optional().nullable(),
});
export const protocolCostingUpdateSchema = z.object({
  packageSpecificCost: z.coerce.number().min(0).optional(),
  packageSpecificReason: z.string().trim().min(1).optional().nullable(),
  note: z.string().optional().nullable(),
});
export const protocolFloorCreateSchema = z.object({
  protocolCostingVersionId: z.string().min(1),
  minMarginPercent: z.coerce.number().min(0).max(99.99),
  roundingUnit: z.coerce.number().int().min(1).default(1000),
  note: z.string().optional().nullable(),
});
export const protocolRecommendedCreateSchema = z.object({
  protocolCostingVersionId: z.string().min(1),
  targetMarginPercent: z.coerce.number().min(0).max(99.99),
  roundingUnit: z.coerce.number().int().min(1).default(1000),
  note: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// HR-PH4 — KPI ENGINE (definitions / periods / targets)
// ---------------------------------------------------------------------------
export const kpiDefinitionCreateSchema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1),
  category: z.enum(["PRODUCTIVITY", "QUALITY", "ATTENDANCE", "CUSTOMER", "SALES", "OPERATIONAL"]),
  description: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  calculationType: z.enum(["COUNT_DISTINCT", "SUM", "AVERAGE", "RATIO", "COUNT"]).optional(),
  sourceType: z.enum(["CONTRIBUTION", "ATTENDANCE", "SESSION", "REVIEW", "LEAVE", "MANUAL"]).optional(),
  direction: z.enum(["HIGHER_BETTER", "LOWER_BETTER", "NEUTRAL"]).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export const kpiDefinitionUpdateSchema = kpiDefinitionCreateSchema.partial().omit({ code: true });

export const kpiPeriodCreateSchema = z.object({
  name: z.string().min(1),
  periodType: z.enum(["MONTHLY", "CUSTOM"]).optional(),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  branchId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
}).refine((v) => v.endDate >= v.startDate, { message: "Ngày kết thúc phải ≥ ngày bắt đầu", path: ["endDate"] });

export const kpiPeriodUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "CALCULATED", "REVIEWED", "LOCKED"]).optional(),
});

export const kpiTargetCreateSchema = z.object({
  kpiDefinitionId: z.string().min(1),
  scope: z.enum(["COMPANY", "BRANCH", "ROLE", "EMPLOYEE"]).optional(),
  scopeRef: z.string().optional().nullable(),
  targetValue: z.coerce.number(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
