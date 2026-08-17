// Nhãn tiếng Việt + tone badge cho các enum Module Spa (dùng ở UI).

type Tone = "default" | "success" | "warning" | "danger" | "muted";

export const GENDER_LABEL: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới",
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  ARRIVED: "Khách đã đến",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
  NO_SHOW: "Không đến",
  RESCHEDULED: "Đổi lịch",
};

export const BOOKING_STATUS_TONE: Record<string, Tone> = {
  NEW: "muted",
  PENDING: "warning",
  CONFIRMED: "default",
  ARRIVED: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  RESCHEDULED: "muted",
};

export const CRM_TYPE_LABEL: Record<string, string> = {
  CALL: "Gọi điện",
  SMS: "Tin nhắn",
  ZALO: "Zalo",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  CONSULT: "Tư vấn trực tiếp",
  FEEDBACK: "Khách phản hồi",
  COMPLAINT: "Khiếu nại",
  INTERNAL_NOTE: "Ghi chú nội bộ",
  FOLLOW_UP: "Follow-up",
  REMINDER: "Nhắc lịch",
  AFTERCARE: "Chăm sóc sau DV",
  OTHER: "Khác",
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ACTIVE: "Đang thực hiện",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
};

export const PLAN_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "default",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "default",
  CANCELLED: "danger",
};

export const STAGE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
};

export const STAGE_STATUS_TONE: Record<string, Tone> = {
  PENDING: "muted",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

// Nhãn tần suất — đơn vị (mục 6)
export const FREQUENCY_UNIT_LABEL: Record<string, string> = {
  DAY: "ngày",
  WEEK: "tuần",
  MONTH: "tháng",
};

// Trạng thái buổi dự kiến (mục 10) — có thể derive từ Booking/Session, đây là nhãn hiển thị.
// Ngoài 5 giá trị enum SessionStatus, còn có các nhãn derive: SCHEDULED/ARRIVED/RESCHEDULED.
export const SESSION_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Chưa lên lịch",
  SCHEDULED: "Đã lên lịch",
  ARRIVED: "Khách đã đến",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  RESCHEDULED: "Dời lịch",
  SKIPPED: "Bỏ qua",
  CANCELLED: "Hủy",
};

export const SESSION_STATUS_TONE: Record<string, Tone> = {
  PLANNED: "muted",
  SCHEDULED: "default",
  ARRIVED: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  RESCHEDULED: "warning",
  SKIPPED: "muted",
  CANCELLED: "danger",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  EWALLET: "Ví điện tử",
  OTHER: "Khác",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn",
};

export const TASK_PRIORITY_TONE: Record<string, Tone> = {
  LOW: "muted",
  NORMAL: "default",
  HIGH: "warning",
  URGENT: "danger",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang làm",
  DONE: "Xong",
  CANCELLED: "Hủy",
};

export const TIMELINE_KIND_LABEL: Record<string, string> = {
  crm: "CSKH",
  booking: "Booking",
  assessment: "Đánh giá",
  plan: "Phác đồ",
  session: "Buổi",
  payment: "Thanh toán",
  invoice: "Hóa đơn",
  proposal: "Báo giá",
  care: "Hướng dẫn",
  recommendation: "Đề xuất SP",
};

export const TIMELINE_KIND_TONE: Record<string, Tone> = {
  crm: "default",
  booking: "warning",
  assessment: "muted",
  plan: "success",
  session: "default",
  payment: "success",
  invoice: "warning",
  proposal: "warning",
  care: "muted",
  recommendation: "default",
};

// ----- Thư viện: Protocol/Form status, kind, product type, priority -----
export const LIBRARY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ACTIVE: "Đang dùng",
  ARCHIVED: "Lưu trữ",
};
export const LIBRARY_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  REVIEW: "warning",
  APPROVED: "default",
  ACTIVE: "success",
  ARCHIVED: "muted",
};
export const PROTOCOL_KIND_LABEL: Record<string, string> = {
  BRAND: "Hãng",
  INTERNAL: "Nội bộ",
};
export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  PROFESSIONAL: "Chuyên nghiệp",
  HOME_CARE: "Chăm sóc tại nhà",
  BOTH: "Cả hai",
};
export const RECOMMENDATION_PRIORITY_LABEL: Record<string, string> = {
  ESSENTIAL: "Thiết yếu",
  RECOMMENDED: "Khuyến nghị",
  OPTIONAL: "Tùy chọn",
};
export const RECOMMENDATION_PRIORITY_TONE: Record<string, Tone> = {
  ESSENTIAL: "danger",
  RECOMMENDED: "default",
  OPTIONAL: "muted",
};

// ----- Module 5–10 labels -----
export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bản nháp", SENT: "Đã gửi", VIEWING: "Khách đang xem", ACCEPTED: "Khách chốt",
  REJECTED: "Khách từ chối", EXPIRED: "Hết hiệu lực", CONVERTED: "Đã chuyển hóa đơn", CANCELLED: "Hủy",
};
export const PROPOSAL_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted", SENT: "warning", VIEWING: "default", ACCEPTED: "success",
  REJECTED: "danger", EXPIRED: "muted", CONVERTED: "success", CANCELLED: "muted",
};
export const PROPOSAL_KIND_LABEL: Record<string, string> = {
  ESSENTIAL: "Thiết yếu", RECOMMENDED: "Khuyến nghị", PREMIUM: "Cao cấp", CUSTOM: "Tùy chỉnh",
};
export const PROPOSAL_ITEM_TYPE_LABEL: Record<string, string> = {
  SERVICE: "Dịch vụ", TECHNOLOGY: "Công nghệ", BRAND_PROTOCOL: "Protocol", PRODUCT: "Sản phẩm", CUSTOM: "Khác",
};
export const INVOICE_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Chưa thanh toán", PARTIAL: "Trả một phần", PAID: "Đã thanh toán", CANCELLED: "Đã hủy",
};
export const INVOICE_STATUS_TONE: Record<string, Tone> = {
  UNPAID: "warning", PARTIAL: "default", PAID: "success", CANCELLED: "muted",
};
export const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang giữ", ALLOCATED: "Đã phân bổ", REFUNDED: "Đã hoàn", VOID: "Đã hủy",
};
export const DEPOSIT_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "warning", ALLOCATED: "success", REFUNDED: "muted", VOID: "muted",
};
// Giá sàn v2 (mục 7)
export const FLOOR_VERSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bản nháp", PENDING_APPROVAL: "Chờ duyệt", APPROVED: "Đã duyệt",
  ACTIVE: "Đang hiệu lực", EXPIRED: "Hết hiệu lực", CANCELLED: "Hủy",
};
export const FLOOR_VERSION_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted", PENDING_APPROVAL: "warning", APPROVED: "default",
  ACTIVE: "success", EXPIRED: "muted", CANCELLED: "muted",
};
export const FLOOR_METHOD_LABEL: Record<string, string> = {
  MARGIN: "Theo biên lợi nhuận", MARKUP: "Theo markup", MANUAL: "Nhập tay có kiểm soát",
};
export const COST_CATEGORY_LABEL: Record<string, string> = {
  MATERIAL: "Vật tư", STAFF: "Nhân sự", MACHINE: "Máy / thiết bị",
  ROOM: "Phòng / giường", OPERATION: "Vận hành", OTHER: "Chi phí khác",
};
// --- Pricing/Costing PH1 — trạng thái + phương pháp overhead ---
export const COSTING_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bản nháp", PUBLISHED: "Đã phát hành", SUPERSEDED: "Đã thay thế",
};
export const COSTING_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted", PUBLISHED: "success", SUPERSEDED: "muted",
};
export const OVERHEAD_METHOD_LABEL: Record<string, string> = {
  MANUAL: "Nhập tay", FIXED_PER_SERVICE: "Cố định mỗi buổi", PER_MINUTE: "Theo phút",
};
export const COST_CALC_TYPE_LABEL: Record<string, string> = {
  FIXED: "Cố định", PER_MINUTE: "Theo phút", PER_SESSION: "Trọn buổi",
  PER_USE: "Theo lần dùng", PERCENT_DIRECT: "% trên chi phí trực tiếp", PER_DURATION: "Theo thời lượng",
};
// Vai trò công việc của nhân sự (đa vai trò) — danh mục gợi ý (mục 22).
export const EMPLOYEE_ROLE_OPTIONS = [
  "Kỹ thuật viên", "Master", "CSKH", "Sales", "Quản lý", "Lễ tân", "Tư vấn", "Bác sĩ",
];
// Nhân sự master data (mục 8)
export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang làm việc", ON_LEAVE: "Tạm nghỉ", RESIGNED: "Nghỉ việc",
};
export const EMPLOYEE_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success", ON_LEAVE: "warning", RESIGNED: "muted",
};
export const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: "Nghỉ phép", SICK: "Nghỉ bệnh", EMERGENCY: "Nghỉ đột xuất", UNAVAILABLE: "Không khả dụng", OTHER: "Khác",
};
export const COMPETENCE_KIND_LABEL: Record<string, string> = {
  TECHNOLOGY: "Công nghệ", SERVICE: "Dịch vụ", PROTOCOL: "Protocol", ROLE: "Vai trò",
};
export const DOW_LABEL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
// Vai trò trong buổi (mục 24).
export const SESSION_STAFF_ROLE_LABEL: Record<string, string> = {
  PRIMARY: "Chính", ASSISTANT: "Hỗ trợ", MASTER: "Master", CHECKER: "Kiểm tra", CONSULTANT: "Tư vấn",
};
export const SESSION_STAFF_ROLE_TONE: Record<string, Tone> = {
  PRIMARY: "default", ASSISTANT: "muted", MASTER: "success", CHECKER: "warning", CONSULTANT: "muted",
};
// CSKH follow-up (mục 31).
export const FOLLOWUP_TRIGGER_LABEL: Record<string, string> = {
  AFTER_SERVICE: "Sau dịch vụ", AFTER_SESSION: "Sau buổi điều trị", BIRTHDAY: "Sinh nhật", MANUAL: "Thủ công",
};
export const CARE_KIND_LABEL: Record<string, string> = {
  PRE_CARE: "Trước dịch vụ", POST_CARE: "Sau dịch vụ", GENERAL: "Chung", FOLLOW_UP: "Theo dõi",
};
export const CARE_KIND_TONE: Record<string, Tone> = {
  PRE_CARE: "warning", POST_CARE: "success", GENERAL: "muted", FOLLOW_UP: "default",
};
export const DELIVERY_CHANNEL_LABEL: Record<string, string> = {
  IN_PERSON: "Trực tiếp", PORTAL: "Portal", EMAIL: "Email", ZALO: "Zalo", WHATSAPP: "WhatsApp", SMS: "SMS",
};
export const PRICE_TYPE_LABEL: Record<string, string> = {
  STANDARD: "Niêm yết", BRANCH: "Chi nhánh", MEMBER: "Thành viên", VIP: "VIP", CAMPAIGN: "Khuyến mãi", CUSTOM: "Đặc biệt",
};
export const PRICE_TARGET_LABEL: Record<string, string> = {
  SERVICE: "Dịch vụ", PRODUCT: "Sản phẩm", TECHNOLOGY: "Công nghệ", PACKAGE: "Gói",
};
export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới", CONTACTED: "Đã liên hệ", BOOKED: "Đã đặt lịch", WON: "Chuyển đổi", LOST: "Mất",
};
export const LEAD_STATUS_TONE: Record<string, Tone> = {
  NEW: "muted", CONTACTED: "warning", BOOKED: "default", WON: "success", LOST: "danger",
};
export const MATERIAL_MOVEMENT_LABEL: Record<string, string> = {
  REQUEST: "Yêu cầu", RESERVE: "Giữ hàng", ISSUE: "Xuất kho", CONSUME: "Tiêu hao", RETURN: "Hoàn trả", WASTE: "Hao hụt", DAMAGE: "Hư hỏng",
};

// ---------------------------------------------------------------------------
// VN2 — Nhãn trạng thái GỘP CHUNG (fallback). Dùng khi điểm hiển thị nhận status
// từ nhiều loại thực thể khác nhau (vd timeline khách) hoặc module kho chưa có
// map riêng. Ưu tiên map chuyên biệt tại chỗ; helper này là lưới an toàn để KHÔNG
// bao giờ lộ giá trị enum tiếng Anh ra giao diện.
// ---------------------------------------------------------------------------
export const COMMON_STATUS_LABEL: Record<string, string> = {
  // Vòng đời chung
  ACTIVE: "Đang hoạt động", INACTIVE: "Ngưng hoạt động",
  OPEN: "Đang mở", CLOSED: "Đã đóng",
  DRAFT: "Bản nháp", PENDING: "Chờ xử lý", SUBMITTED: "Đã gửi",
  APPROVED: "Đã duyệt", REJECTED: "Từ chối",
  IN_PROGRESS: "Đang thực hiện", COMPLETED: "Hoàn thành", DONE: "Hoàn thành",
  CANCELLED: "Đã hủy", CANCELED: "Đã hủy", ARCHIVED: "Lưu trữ",
  CONFIRMED: "Đã xác nhận", NEW: "Mới",
  // Bảo hành / RMA / kho
  RECEIVED: "Đã tiếp nhận", DIAGNOSING: "Đang chẩn đoán", REPAIRING: "Đang sửa",
  WAITING_VENDOR: "Chờ hãng", RETURNED: "Đã trả", SCRAPPED: "Đã thanh lý",
  RESOLVED: "Đã xử lý", ON_HOLD: "Tạm dừng",
  // Kho / lắp ráp
  WIP: "Đang lắp", CONSUMED: "Đã tiêu hao", ALLOCATED: "Đã cấp phát", IN_STOCK: "Trong kho",
};

/** Trả nhãn tiếng Việt cho một status BẤT KỲ, thử các map chuyên biệt rồi tới map chung. */
export function statusLabel(value?: string | null): string {
  if (!value) return "—";
  return (
    BOOKING_STATUS_LABEL[value] ??
    PLAN_STATUS_LABEL[value] ??
    STAGE_STATUS_LABEL[value] ??
    SESSION_STATUS_LABEL[value] ??
    TASK_STATUS_LABEL[value] ??
    LIBRARY_STATUS_LABEL[value] ??
    PROPOSAL_STATUS_LABEL[value] ??
    INVOICE_STATUS_LABEL[value] ??
    DEPOSIT_STATUS_LABEL[value] ??
    FLOOR_VERSION_STATUS_LABEL[value] ??
    EMPLOYEE_STATUS_LABEL[value] ??
    LEAVE_TYPE_LABEL[value] ??
    SESSION_STAFF_ROLE_LABEL[value] ??
    LEAD_STATUS_LABEL[value] ??
    RECOMMENDATION_PRIORITY_LABEL[value] ??
    PAYMENT_METHOD_LABEL[value] ??
    CARE_KIND_LABEL[value] ??
    CONTAINER_STATUS_LABEL[value] ??
    CUSTOMER_MATERIAL_STATUS_LABEL[value] ??
    MATERIAL_SOURCE_LABEL[value] ??
    COMMON_STATUS_LABEL[value] ??
    value
  );
}

// --- Vật tư spa ---
export const CONTAINER_STATUS_LABEL: Record<string, string> = {
  IN_USE: "Đang sử dụng", LOW: "Sắp hết", EMPTY: "Hết", DISPOSED: "Đã hủy",
};
export const CONTAINER_STATUS_TONE: Record<string, Tone> = {
  IN_USE: "success", LOW: "warning", EMPTY: "muted", DISPOSED: "danger",
};
export const CUSTOMER_MATERIAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang sử dụng", USED_UP: "Đã dùng hết", CANCELLED: "Đã hủy",
};
export const MATERIAL_SOURCE_LABEL: Record<string, string> = {
  SHARED_STOCK: "Kho vật tư sử dụng", CUSTOMER_OWNED: "Vật tư khách hàng",
};
