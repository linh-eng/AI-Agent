// =============================================================================
// Nhãn tiếng Việt + tone màu cho các enum hiển thị trên UI.
// Nguồn sự thật dùng chung cho mọi trang (tránh khai báo lặp trong từng page).
// =============================================================================
type Tone = "default" | "success" | "warning" | "danger" | "muted";

// ----- Trạng thái chứng từ (phiếu nhập/xuất/chuyển/kiểm kê) -----
export const DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
};

export const DOC_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "muted",
};

// Kiểm kê: DRAFT hiển thị là "Đang kiểm" cho sát nghiệp vụ.
export const COUNT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Đang kiểm",
  POSTED: "Đã duyệt",
  CANCELLED: "Đã hủy",
};

export const COUNT_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "warning",
  POSTED: "success",
  CANCELLED: "muted",
};

// ----- Loại phiếu xuất -----
export const ISSUE_TYPE_LABEL: Record<string, string> = {
  SALE: "Bán hàng",
  INTERNAL_USE: "Dùng nội bộ",
  DISPOSAL: "Hủy",
  ADJUSTMENT: "Điều chỉnh",
};

export const ISSUE_TYPE_TONE: Record<string, Tone> = {
  SALE: "success",
  INTERNAL_USE: "default",
  DISPOSAL: "danger",
  ADJUSTMENT: "muted",
};

// ----- Chế độ quản lý sản phẩm -----
export const TRACKING_MODE_LABEL: Record<string, string> = {
  LOT: "Theo lô",
  QUANTITY: "Số lượng",
};

export const TRACKING_MODE_TONE: Record<string, Tone> = {
  LOT: "default",
  QUANTITY: "muted",
};

// ----- Trạng thái tài sản/thiết bị -----
export const ASSET_STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "Trong kho",
  IN_USE: "Đang dùng",
  MAINTENANCE: "Bảo trì",
  RETIRED: "Thanh lý",
};

export const ASSET_STATUS_TONE: Record<string, Tone> = {
  IN_STOCK: "success",
  IN_USE: "default",
  MAINTENANCE: "warning",
  RETIRED: "muted",
};

// ----- Loại bảo trì thiết bị -----
export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  MAINTENANCE: "Bảo trì",
  REPAIR: "Sửa chữa",
  INSPECTION: "Kiểm tra",
};

export const MAINTENANCE_TYPE_TONE: Record<string, Tone> = {
  MAINTENANCE: "default",
  REPAIR: "danger",
  INSPECTION: "muted",
};
