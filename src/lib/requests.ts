// =============================================================================
// v1.5 — Lớp Yêu cầu (5A-0): cấu hình 8 loại yêu cầu, SLA hoàn tất theo
// mục 7.1, nhóm lý do từ chối, nhãn trạng thái. Nguồn sự thật cho service + UI.
// =============================================================================
import type { RequestType, RequestStatus, RequestPriority } from "@prisma/client";

export interface RequestTypeDef {
  code: RequestType;
  label: string;
  /** Kho làm gì / sinh ra phiếu gì */
  produces: string;
  /** Cần đối tác (NCC/khách) không */
  needsPartner?: boolean;
  /** Cần dòng hàng không (YCT/YCU có thể không) */
  needsLines?: boolean;
  /** SLA hoàn tất mặc định (giờ làm việc). P1 riêng = trong ngày. */
  completionHours?: number;
  /** SLA hoàn tất theo ngày làm việc (ưu tiên hơn completionHours nếu có) */
  completionDays?: number;
}

export const REQUEST_TYPES: Record<RequestType, RequestTypeDef> = {
  YCN: { code: "YCN", label: "Yêu cầu nhập kho", produces: "Phiếu nhập N1–N12", needsPartner: true, needsLines: true, completionDays: 1 },
  YCX: { code: "YCX", label: "Yêu cầu xuất kho", produces: "Phiếu xuất X1–X11", needsLines: true, completionDays: 2 },
  YCC: { code: "YCC", label: "Yêu cầu chuyển kho nội bộ", produces: "Phiếu X7", needsLines: true, completionDays: 2 },
  YCM: { code: "YCM", label: "Yêu cầu mua hàng", produces: "PO → sau đó YCN", needsLines: true, completionDays: 2 },
  YCK: { code: "YCK", label: "Yêu cầu kiểm kê đột xuất", produces: "Phiếu kiểm kê", completionDays: 2 },
  YCU: { code: "YCU", label: "Yêu cầu mở khóa hàng dự án", produces: "Cờ mở khóa trên serial", completionHours: 4 },
  YCT: { code: "YCT", label: "Yêu cầu tra cứu/xác minh serial", produces: "Kết quả tra cứu", completionHours: 2 },
  YCKT: { code: "YCKT", label: "Yêu cầu nhận hàng & kiểm tra", produces: "Biên bản testing → YCN", needsPartner: true, needsLines: true, completionDays: 3 },
};

export const REQUEST_TYPE_LIST = Object.values(REQUEST_TYPES);

/** SLA tiếp nhận sau khi gửi (mục 7.1) — 4 giờ làm việc, dùng chung. */
export const RECEIPT_SLA_HOURS = 4;

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Nháp",
  PENDING_RECEIPT: "Chờ tiếp nhận",
  RECEIVED: "Đã tiếp nhận",
  IN_PROGRESS: "Đang thực hiện",
  PENDING_SUPPLEMENT: "Chờ bổ sung",
  PENDING_ACCEPTANCE: "Chờ nghiệm thu",
  DONE: "Hoàn tất",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  P1: "P1 — Gấp (trong ngày)",
  P2: "P2 — Bình thường",
  P3: "P3 — Thấp",
};

/** Nhóm lý do từ chối (5A-0) — hệ thống gợi ý phương án thay thế theo nhóm. */
export const REJECT_REASON_GROUPS = [
  { code: "NO_STOCK", label: "Không đủ tồn khả dụng" },
  { code: "LOCKED_PROJECT", label: "Hàng khóa dự án khác" },
  { code: "IN_WARRANTY", label: "Hàng đang bảo hành" },
  { code: "POLICY", label: "Sai chính sách" },
  { code: "CREDIT", label: "Vượt hạn mức công nợ" },
  { code: "OTHER", label: "Lý do khác" },
] as const;

/** Nhóm trường thiếu khi Trả lại bổ sung. */
export const SUPPLEMENT_FIELDS = [
  { code: "DOCS", label: "Thiếu chứng từ" },
  { code: "PROJECT", label: "Thiếu dự án / đánh dấu hàng thương mại" },
  { code: "SERIAL", label: "Sai/thiếu serial chỉ định" },
  { code: "LOCATION", label: "Chưa rõ địa điểm giao" },
  { code: "OTHER", label: "Khác" },
] as const;

/**
 * Tính SLA hoàn tất (giờ) cho một yêu cầu.
 * P1 = trong ngày (tính đến 17:00 hôm nay ~ trả về số giờ nhỏ, service xử lý riêng).
 */
export function getCompletionConfig(type: RequestType): { hours?: number; days?: number } {
  const def = REQUEST_TYPES[type];
  return { hours: def.completionHours, days: def.completionDays };
}
