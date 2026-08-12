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
  DRAFT: "Nháp", SENT: "Đã gửi", ACCEPTED: "Đã chốt", REJECTED: "Từ chối", EXPIRED: "Hết hạn",
};
export const PROPOSAL_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted", SENT: "warning", ACCEPTED: "success", REJECTED: "danger", EXPIRED: "muted",
};
export const PROPOSAL_KIND_LABEL: Record<string, string> = {
  ESSENTIAL: "Thiết yếu", RECOMMENDED: "Khuyến nghị", PREMIUM: "Cao cấp", CUSTOM: "Tùy chỉnh",
};
export const PROPOSAL_ITEM_TYPE_LABEL: Record<string, string> = {
  SERVICE: "Dịch vụ", TECHNOLOGY: "Công nghệ", BRAND_PROTOCOL: "Protocol", PRODUCT: "Sản phẩm", CUSTOM: "Khác",
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
    SESSION_STATUS_LABEL[value] ??
    TASK_STATUS_LABEL[value] ??
    LIBRARY_STATUS_LABEL[value] ??
    PROPOSAL_STATUS_LABEL[value] ??
    LEAD_STATUS_LABEL[value] ??
    COMMON_STATUS_LABEL[value] ??
    value
  );
}
