// =============================================================================
// i18n — Kiến trúc bản địa hóa (localization).
//
// NGUYÊN TẮC (bắt buộc, xem CLAUDE.md mục "Ngôn ngữ giao diện"):
//   * Ngôn ngữ giao diện MẶC ĐỊNH: Tiếng Việt (vi-VN).
//   * Code / DB / API identifier: tiếng Anh (KHÔNG dịch).
//   * KHÔNG hiển thị giá trị enum tiếng Anh trực tiếp ra UI — luôn qua map nhãn
//     (src/lib/clinic-labels.ts, src/lib/labels.ts) hoặc `statusLabel()`.
//   * Định dạng số/tiền/ngày theo vi-VN (formatNumber/formatCurrency/formatDate/
//     formatDateTime trong src/lib/utils.ts).
//
// CHUẨN BỊ CHO ĐA NGÔN NGỮ (chưa bật switcher trong phase này):
//   * Nhãn UI được TẬP TRUNG ở các module labels (không rải chuỗi khắp component
//     một cách khó gom). Khi cần thêm English, chỉ việc bổ sung bảng nhãn `en`
//     song song và chọn theo `locale` — KHÔNG phải viết lại component.
//   * `DEFAULT_LOCALE` là điểm cấu hình duy nhất; tương lai đọc từ cookie/user pref.
// =============================================================================

export type Locale = "vi-VN" | "en-US";

/** Ngôn ngữ mặc định hiện tại của toàn hệ thống. */
export const DEFAULT_LOCALE: Locale = "vi-VN";

export const SUPPORTED_LOCALES: Locale[] = ["vi-VN"]; // "en-US" sẽ bổ sung sau

/**
 * Chọn bản dịch theo locale từ một từ điển { locale: value }, fallback về vi-VN.
 * Dùng khi thật sự cần chuỗi song ngữ; đa số nhãn hiện tại là vi-VN cố định.
 */
export function t<T>(dict: Partial<Record<Locale, T>>, locale: Locale = DEFAULT_LOCALE): T | undefined {
  return dict[locale] ?? dict[DEFAULT_LOCALE];
}
