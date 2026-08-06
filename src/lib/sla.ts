// =============================================================================
// Bảng SLA cấu hình được (mục A6 quy trình). Quá hạn -> cảnh báo đỏ.
// Có thể chuyển sang bảng cấu hình DB sau; hiện để hằng số tập trung.
// =============================================================================
export const SLA_DAYS = {
  DAMAGED: 15, // K-HH: chốt hướng xử lý trong 15 ngày
  VENDOR_RETURN: 7, // đổi hàng lỗi NCC 7 ngày
  VENDOR_RMA: 30, // K-BH-NCC mặc định 30 ngày theo hãng
  REPAIR_QUOTE: 10, // K-SC chờ duyệt báo giá 10 ngày
  PROJECT_STOCK: 30, // K-DA tồn sau nghiệm thu 30 ngày
} as const;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86400000);
}

/** Số ngày quá hạn (âm nếu còn hạn). */
export function overdueDays(dueDate: Date | string | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function isOverdue(dueDate: Date | string | null | undefined, now = new Date()): boolean {
  return overdueDays(dueDate, now) > 0;
}
