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
  DRAFT: "Nháp",
  ACTIVE: "Đang thực hiện",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã dừng",
};

export const PLAN_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "default",
  CANCELLED: "danger",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Dự kiến",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
};

export const SESSION_STATUS_TONE: Record<string, Tone> = {
  PLANNED: "muted",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
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
};

export const TIMELINE_KIND_TONE: Record<string, Tone> = {
  crm: "default",
  booking: "warning",
  assessment: "muted",
  plan: "success",
  session: "default",
  payment: "success",
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
