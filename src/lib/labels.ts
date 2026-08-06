// Nhãn tiếng Việt + tone màu cho các enum hiển thị trên UI.
type Tone = "default" | "success" | "warning" | "danger" | "muted";

export const SERIAL_STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "Trong kho",
  WIP: "Đang lắp ráp",
  RESERVED: "Đã giữ",
  SOLD: "Đã bán",
  RENTED: "Cho thuê",
  IN_WARRANTY_INTAKE: "Tiếp nhận BH",
  AT_VENDOR: "Đang ở NCC",
  IN_REPAIR: "Đang sửa",
  DAMAGED: "Hư hỏng",
  REPLACED: "Đã thay thế",
  DISASSEMBLED: "Đã tháo/rã",
  SCRAPPED: "Đã hủy",
};

export const SERIAL_STATUS_TONE: Record<string, Tone> = {
  IN_STOCK: "success",
  WIP: "warning",
  RESERVED: "default",
  SOLD: "muted",
  RENTED: "default",
  IN_WARRANTY_INTAKE: "warning",
  AT_VENDOR: "warning",
  IN_REPAIR: "warning",
  DAMAGED: "danger",
  REPLACED: "muted",
  DISASSEMBLED: "muted",
  SCRAPPED: "danger",
};

export const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy",
};

export const DOC_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export const WO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ALLOCATING: "Đang cấp phát",
  ASSEMBLING: "Đang lắp ráp",
  QC: "Chờ/đạt QC",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const WO_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  ALLOCATING: "warning",
  ASSEMBLING: "warning",
  QC: "default",
  DONE: "success",
  CANCELLED: "muted",
};

export const WO_MODE_LABEL: Record<string, string> = {
  TO_ORDER: "Lắp theo đơn",
  TO_STOCK: "Lắp để tồn kho",
};
